import type { CalculationResult, CalculationStep } from '../types/calculations';
import { useEngineerReviewStore } from '../store/engineerReviewStore';
import { useCalculationStore } from '../store/calculationStore';

export async function exportToPDF(result: CalculationResult, projectDetails?: Record<string, string>): Promise<void> {
  const savePath = window.electronAPI
    ? await window.electronAPI.saveFileDialog('calculation-report.pdf')
    : null;

  const { stepReviews, engineerName, registrationNumber } = useEngineerReviewStore.getState();
  const activeModule = useCalculationStore.getState().activeModule;
  const engName = projectDetails?.engineer_name || engineerName;
  const eiz = projectDetails?.eiz_number || registrationNumber;
  const reviewer = [engName, eiz].filter(Boolean).join(' — ');

  const steps = result.steps ?? [];
  const counts = { accepted: 0, overridden: 0, flagged: 0, pending: 0 };
  const mappedSteps = steps.map((step) => {
    const record = stepReviews[`${activeModule}:${step.step_number}`] || stepReviews[`calc:${step.step_number}`];
    const status = record?.status ?? 'pending';
    counts[status] += 1;
    return {
      ...step,
      review_status: status,
      engineer_name: reviewer,
      effective_result: status === 'overridden' ? record?.overrideValue : (step.platform_result ?? step.result),
      override_reason: record?.overrideReason ?? null,
      flag_note: record?.flagNote ?? null,
    };
  });

  const payload = {
    ...result,
    steps: mappedSteps,
    review_summary: counts,
    engineer_name: engName,
    eiz_number: eiz,
    project_ref: projectDetails?.project_ref,
    design_brief: projectDetails?.design_brief,
    module: activeModule,
  };

  if (counts.pending > 0) {
    payload.warnings = [
      ...(payload.warnings ?? []),
      `${counts.pending} steps not yet reviewed — do not use for construction`,
    ];
  }

  try {
    const res = await fetch('http://localhost:8000/export/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error('PDF Generation failed');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    if (savePath) {
      const a = document.createElement('a');
      a.href = url;
      a.download = savePath;
      a.click();
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'calculation-report.pdf';
      a.click();
    }

    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    if (!savePath) {
      downloadAsHTML(payload);
    } else {
      downloadAsHTML(payload, savePath.replace('.pdf', '.html'));
    }
  }
}

export async function exportToExcel(result: CalculationResult): Promise<void> {
  const savePath = window.electronAPI
    ? await window.electronAPI.saveFileDialog('calculation-report.xlsx')
    : null;

  const csv = generateCSV(result);
  const filename = savePath || 'calculation-report.csv';
  downloadBlob(csv, filename.endsWith('.xlsx') ? filename.replace('.xlsx', '.csv') : filename, 'text/csv');
}

function generateCSV(result: CalculationResult): string {
  const lines = ['Step,Title,Formula,Substitution,Platform Result,Effective Result,Review Status,Override Reason,Reference'];
  for (const step of result.steps) {
    const platform = step.platform_result ?? step.result;
    const effective = step.engineer_override ?? platform;
    lines.push(
      [
        step.step_number,
        `"${step.title}"`,
        `"${step.formula}"`,
        `"${step.substitution}"`,
        `"${platform}"`,
        `"${effective}"`,
        `"${step.review_status ?? 'pending'}"`,
        `"${step.override_reason ?? ''}"`,
        `"${step.reference}"`,
      ].join(',')
    );
  }
  return lines.join('\n');
}

function stepHtml(step: CalculationStep, reviewKey: string, stepNum: number): string {
  const { stepReviews } = useEngineerReviewStore.getState();
  const stored = stepReviews[`${reviewKey}:${stepNum}`];
  const platform = step.platform_result ?? step.result;
  const overridden = stored?.status === 'overridden';
  const effective =
    overridden && stored?.overrideValue
      ? `${stored.overrideValue}${step.unit ? ` ${step.unit}` : ''}`
      : platform;
  return `
    <div style="border:1px solid #ddd;padding:15px;margin:10px 0;border-radius:4px;">
      <h3>Step ${step.step_number}: ${step.title}</h3>
      <p style="font-family:monospace;color:#0f3460;">${step.formula}</p>
      <p>${step.substitution}</p>
      <p><strong>${effective}</strong></p>
      ${overridden ? `<p style="color:#b45309;">Platform: ${platform}<br/>Reason: ${stored?.overrideReason ?? '—'}</p>` : ''}
      ${stored?.status === 'flagged' ? `<p style="color:#dc2626;">Flagged: ${stored.flagNote}</p>` : ''}
      <p style="font-size:12px;color:#666;">Ref: ${step.reference}</p>
    </div>`;
}

function downloadAsHTML(result: CalculationResult, filename = 'calculation-report.html'): void {
  const { engineerName, registrationNumber } = useEngineerReviewStore.getState();
  const reviewer = [engineerName, registrationNumber].filter(Boolean).join(' — ');
  const stepsHtml = result.steps.map((s) => stepHtml(s, 'calc', s.step_number)).join('');
  const review = result.review_summary;

  const html = `<!DOCTYPE html><html><head><title>ARCHITEX-CAD Report</title></head>
<body style="font-family:Arial,sans-serif;margin:40px;">
<h1>ARCHITEX-CAD Calculation Report</h1>
<p>Status: <strong>${result.status.toUpperCase()}</strong></p>
${reviewer ? `<p>Reviewed by: <strong>${reviewer}</strong></p>` : ''}
${review ? `<p>Review summary: accepted ${review.accepted ?? 0}, overridden ${review.overridden ?? 0}, flagged ${review.flagged ?? 0}, pending ${review.pending ?? 0}</p>` : ''}
<h2>Summary</h2>
<pre>${JSON.stringify(result.summary, null, 2)}</pre>
<h2>Steps</h2>${stepsHtml}
</body></html>`;

  downloadBlob(html, filename, 'text/html');
}

function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

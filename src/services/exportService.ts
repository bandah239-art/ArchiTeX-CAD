import type { CalculationResult } from '../types/calculations';

export async function exportToPDF(result: CalculationResult): Promise<void> {
  const savePath = window.electronAPI
    ? await window.electronAPI.saveFileDialog('calculation-report.pdf')
    : null;

  if (!savePath) {
    downloadAsHTML(result);
    return;
  }

  downloadAsHTML(result, savePath.replace('.pdf', '.html'));
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
  const lines = ['Step,Title,Formula,Substitution,Result,Reference'];
  for (const step of result.steps) {
    lines.push(
      [
        step.step_number,
        `"${step.title}"`,
        `"${step.formula}"`,
        `"${step.substitution}"`,
        `"${step.result}"`,
        `"${step.reference}"`,
      ].join(',')
    );
  }
  return lines.join('\n');
}

function downloadAsHTML(result: CalculationResult, filename = 'calculation-report.html'): void {
  const stepsHtml = result.steps
    .map(
      (s) => `
    <div style="border:1px solid #ddd;padding:15px;margin:10px 0;border-radius:4px;">
      <h3>Step ${s.step_number}: ${s.title}</h3>
      <p style="font-family:monospace;color:#0f3460;">${s.formula}</p>
      <p>${s.substitution}</p>
      <p><strong>${s.result}</strong></p>
      <p style="font-size:12px;color:#666;">Ref: ${s.reference}</p>
    </div>`
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><title>INFRAFRICA Report</title></head>
<body style="font-family:Arial,sans-serif;margin:40px;">
<h1>INFRAFRICA Calculation Report</h1>
<p>Status: <strong>${result.status.toUpperCase()}</strong></p>
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

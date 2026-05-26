import { useMemo, useState } from 'react';
import type { CalculationResult, CalculationStatus } from '../../types/calculations';
import { useEngineerReviewStore, type StepReviewRecord } from '../../store/engineerReviewStore';
import { DepthTable, extractDepthTable } from './DepthTable';
import { PressureDiagram } from './pressure/PressureDiagram';
import type { PressureDiagramData } from '../../services/pressureAPI';

interface ResultsDisplayProps {
  result: CalculationResult;
  pressureDiagram?: PressureDiagramData | null;
  reviewKeyPrefix?: string;
  /** When true, diagram is shown elsewhere (e.g. Pressure tab header). */
  hideDiagram?: boolean;
}

type ReviewAction = 'accepted' | 'overridden' | 'flagged' | 'pending';

interface StepReviewState {
  status: ReviewAction;
  overrideValue: string;
  overrideReason: string;
  flagNote: string;
}

const STATUS_COLORS: Record<CalculationStatus, string> = {
  pass: 'border-green-600/50 bg-green-900/10',
  fail: 'border-red-600/50 bg-red-900/10',
  warning: 'border-amber-600/50 bg-amber-900/10',
  info: 'border-blue-600/30 bg-blue-900/10',
};

const RESULT_COLORS: Record<CalculationStatus, string> = {
  pass: 'text-green-400',
  fail: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-blue-300',
};

const REVIEW_BORDER: Record<ReviewAction, string> = {
  accepted: 'ring-1 ring-green-600/40',
  overridden: 'ring-1 ring-amber-500/50',
  flagged: 'ring-1 ring-red-600/50',
  pending: '',
};

function parsePlatformNumber(result: string): string {
  const m = result.match(/[-+]?[\d,.]+/);
  return m ? m[0].replace(/,/g, '') : '';
}

export function ResultsDisplay({
  result,
  pressureDiagram,
  reviewKeyPrefix = 'calc',
  hideDiagram = false,
}: ResultsDisplayProps) {
  const {
    engineerName,
    registrationNumber,
    setEngineerName,
    setRegistrationNumber,
    stepReviews,
    setStepReview,
  } = useEngineerReviewStore();
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1]));
  const [reviews, setReviews] = useState<Record<number, StepReviewState>>({});
  const [overrideStep, setOverrideStep] = useState<number | null>(null);
  const [flagStep, setFlagStep] = useState<number | null>(null);

  const diagram =
    pressureDiagram ??
    (result as CalculationResult & { pressure_diagram_data?: PressureDiagramData }).pressure_diagram_data;

  const depthRows = extractDepthTable(result.summary ?? {});

  const summaryCounts = useMemo(() => {
    const base = (result as CalculationResult & { review_summary?: Record<string, number> }).review_summary ?? {
      accepted: 0,
      overridden: 0,
      flagged: 0,
      pending: 0,
    };
    const steps = result.steps ?? [];
    const counts = { accepted: 0, overridden: 0, flagged: 0, pending: 0 };
    for (const step of steps) {
      const n = step.step_number;
      const local = reviews[n]?.status;
      const rs = local ?? (step.review_status as ReviewAction | undefined) ?? 'pending';
      if (rs in counts) counts[rs as keyof typeof counts] += 1;
      else counts.pending += 1;
    }
    if (Object.keys(reviews).length === 0 && steps.length > 0) {
      return {
        accepted: base.accepted ?? 0,
        overridden: base.overridden ?? 0,
        flagged: base.flagged ?? 0,
        pending: base.pending ?? steps.length,
      };
    }
    return counts;
  }, [result, reviews]);

  const toggleStep = (stepNum: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNum)) next.delete(stepNum);
      else next.add(stepNum);
      return next;
    });
  };

  const setReview = (stepNum: number, patch: Partial<StepReviewState>) => {
    setReviews((prev) => {
      const base: StepReviewState = prev[stepNum] ?? {
        status: 'pending',
        overrideValue: '',
        overrideReason: '',
        flagNote: '',
      };
      return { ...prev, [stepNum]: { ...base, ...patch } };
    });
  };

  const persistReview = (stepNum: number, record: StepReviewRecord) => {
    setStepReview(`${reviewKeyPrefix}:${stepNum}`, record);
  };

  const getStoredReview = (stepNum: number): StepReviewState | undefined => {
    const stored = stepReviews[`${reviewKeyPrefix}:${stepNum}`];
    if (!stored) return undefined;
    return {
      status: stored.status,
      overrideValue: stored.overrideValue,
      overrideReason: stored.overrideReason,
      flagNote: stored.flagNote,
    };
  };

  const acceptStep = (stepNum: number) => {
    setReview(stepNum, { status: 'accepted' });
    persistReview(stepNum, {
      status: 'accepted',
      overrideValue: '',
      overrideReason: '',
      flagNote: '',
      reviewedAt: new Date().toISOString(),
    });
    setOverrideStep(null);
    setFlagStep(null);
  };

  const confirmOverride = (stepNum: number) => {
    const st = reviews[stepNum];
    if (!st?.overrideValue.trim() || !st.overrideReason.trim()) return;
    setReview(stepNum, { status: 'overridden' });
    persistReview(stepNum, {
      status: 'overridden',
      overrideValue: st.overrideValue,
      overrideReason: st.overrideReason,
      flagNote: '',
      reviewedAt: new Date().toISOString(),
    });
    setOverrideStep(null);
  };

  const confirmFlag = (stepNum: number) => {
    const st = reviews[stepNum];
    if (!st?.flagNote.trim()) return;
    setReview(stepNum, { status: 'flagged' });
    persistReview(stepNum, {
      status: 'flagged',
      overrideValue: '',
      overrideReason: '',
      flagNote: st.flagNote,
      reviewedAt: new Date().toISOString(),
    });
    setFlagStep(null);
  };

  const pendingCount = summaryCounts.pending;
  const reviewerLabel = [engineerName, registrationNumber].filter(Boolean).join(' · ');

  return (
    <div className="space-y-3">
      <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700 space-y-2">
        <span className="text-sm font-semibold text-gray-200">Engineer control</span>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Engineer name"
            value={engineerName}
            onChange={(e) => setEngineerName(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white"
          />
          <input
            type="text"
            placeholder="Registration no."
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white"
          />
        </div>
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="px-2 py-0.5 rounded bg-green-900/30 text-green-400">
            {summaryCounts.accepted} accepted
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-900/30 text-amber-400">
            {summaryCounts.overridden} overridden
          </span>
          <span className="px-2 py-0.5 rounded bg-red-900/30 text-red-400">
            {summaryCounts.flagged} flagged
          </span>
          <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-400">
            {summaryCounts.pending} pending
          </span>
        </div>
        {pendingCount > 0 && (
          <p className="text-xs text-amber-400">
            {pendingCount} steps not yet reviewed — do not use for construction
          </p>
        )}
      </div>

      {diagram && !hideDiagram && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Pressure diagram</h3>
          <PressureDiagram data={diagram} />
        </div>
      )}

      {depthRows && <DepthTable rows={depthRows} />}

      <div
        className={`p-3 rounded-lg border ${
          result.status === 'pass'
            ? 'border-green-600/50 bg-green-900/20'
            : result.status === 'fail'
              ? 'border-red-600/50 bg-red-900/20'
              : 'border-amber-600/50 bg-amber-900/20'
        }`}
      >
        <div className="text-sm font-semibold uppercase">
          Status:{' '}
          <span
            className={
              result.status === 'pass'
                ? 'text-green-400'
                : result.status === 'fail'
                  ? 'text-red-400'
                  : 'text-amber-400'
            }
          >
            {result.status}
          </span>
        </div>
        {Object.entries(result.summary ?? {})
          .filter(([key]) => key !== 'depth_table')
          .map(([key, value]) => (
          <div key={key} className="flex justify-between text-xs mt-1">
            <span className="text-gray-500">{key.replace(/_/g, ' ')}</span>
            <span className="text-gray-200">
              {typeof value === 'object' && value !== null
                ? Array.isArray(value)
                  ? `[${(value as unknown[]).length} items]`
                  : Object.entries(value as Record<string, unknown>)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')
                : String(value)}
            </span>
          </div>
        ))}
      </div>

      {(result.warnings ?? []).map((w, i) => (
        <div key={i} className="text-xs text-amber-400 bg-amber-900/20 p-2 rounded">
          ⚠ {w}
        </div>
      ))}

      {(result.errors ?? []).map((e, i) => (
        <div key={i} className="text-xs text-red-400 bg-red-900/20 p-2 rounded">
          ✗ {e}
        </div>
      ))}

      {(result.steps ?? []).map((step) => {
        const status = (step.status || 'info') as CalculationStatus;
        const isExpanded = expandedSteps.has(step.step_number);
        const platformResult = step.platform_result ?? step.result;
        const review = reviews[step.step_number] ?? getStoredReview(step.step_number);
        const reviewStatus: ReviewAction =
          review?.status ?? (step.review_status as ReviewAction) ?? 'pending';
        const displayResult =
          reviewStatus === 'overridden' && review?.overrideValue
            ? `${review.overrideValue}${step.unit ? ` ${step.unit}` : ''}`
            : platformResult;

        return (
          <div
            key={step.step_number}
            className={`border rounded-lg overflow-hidden ${STATUS_COLORS[status]} ${REVIEW_BORDER[reviewStatus]}`}
          >
            <div className="p-3 cursor-pointer" onClick={() => toggleStep(step.step_number)}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-2 flex-wrap">
                  <span>
                    Step {step.step_number}: {step.title}
                  </span>
                  {reviewStatus === 'accepted' && (
                    <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px]">
                      ACCEPTED
                    </span>
                  )}
                  {reviewStatus === 'overridden' && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px]">
                      OVERRIDDEN
                    </span>
                  )}
                  {reviewStatus === 'flagged' && (
                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px]">
                      FLAGGED
                    </span>
                  )}
                </span>
                <span className="text-gray-600 text-xs">{isExpanded ? '▼' : '▶'}</span>
              </div>

              {isExpanded && (
                <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-mono text-infra-highlight/80">{step.formula}</p>
                  <p className="text-xs text-gray-400">{step.substitution}</p>
                  <p className={`text-xs font-semibold ${RESULT_COLORS[status]}`}>{displayResult}</p>
                  {reviewStatus === 'overridden' && (
                    <p className="text-[10px] text-gray-500">
                      Platform: {platformResult}
                      {review?.overrideReason && (
                        <>
                          <br />
                          Reason: {review.overrideReason}
                        </>
                      )}
                      {reviewerLabel && (
                        <>
                          <br />
                          Reviewed by: {reviewerLabel}
                        </>
                      )}
                    </p>
                  )}
                  {reviewStatus === 'flagged' && review?.flagNote && (
                    <p className="text-[10px] text-red-300">Flag: {review.flagNote}</p>
                  )}
                  {step.reference && (
                    <p className="text-xs text-gray-600 text-right">Ref: {step.reference}</p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-700/50">
                    <button
                      type="button"
                      onClick={() => acceptStep(step.step_number)}
                      className="px-2 py-1 text-[10px] rounded bg-green-700/40 text-green-300 hover:bg-green-700/60"
                    >
                      ACCEPT
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOverrideStep(step.step_number);
                        setReview(step.step_number, {
                          overrideValue: parsePlatformNumber(platformResult),
                        });
                      }}
                      className="px-2 py-1 text-[10px] rounded bg-amber-700/40 text-amber-200 hover:bg-amber-700/60"
                    >
                      OVERRIDE
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlagStep(step.step_number)}
                      className="px-2 py-1 text-[10px] rounded bg-red-800/40 text-red-200 hover:bg-red-800/60"
                    >
                      FLAG
                    </button>
                  </div>

                  {overrideStep === step.step_number && (
                    <div className="space-y-2 p-2 bg-amber-900/20 rounded border border-amber-700/40">
                      <input
                        type="text"
                        placeholder="Override value"
                        className="w-full bg-gray-900 border border-gray-600 rounded p-1.5 text-xs text-white"
                        value={reviews[step.step_number]?.overrideValue ?? ''}
                        onChange={(e) => setReview(step.step_number, { overrideValue: e.target.value })}
                      />
                      <textarea
                        placeholder="Mandatory reason for override"
                        className="w-full bg-gray-900 border border-gray-600 rounded p-1.5 text-xs text-white h-14 resize-none"
                        value={reviews[step.step_number]?.overrideReason ?? ''}
                        onChange={(e) => setReview(step.step_number, { overrideReason: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => confirmOverride(step.step_number)}
                        className="px-3 py-1 text-xs rounded bg-amber-600 text-white"
                      >
                        CONFIRM OVERRIDE
                      </button>
                    </div>
                  )}

                  {flagStep === step.step_number && (
                    <div className="space-y-2 p-2 bg-red-900/20 rounded border border-red-700/40">
                      <textarea
                        placeholder="Flag note — what needs checking"
                        className="w-full bg-gray-900 border border-gray-600 rounded p-1.5 text-xs text-white h-14 resize-none"
                        value={reviews[step.step_number]?.flagNote ?? ''}
                        onChange={(e) => setReview(step.step_number, { flagNote: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => confirmFlag(step.step_number)}
                        className="px-3 py-1 text-xs rounded bg-red-700 text-white"
                      >
                        CONFIRM FLAG
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Nested pressure result from foundation / road / bridge auto-runs */
export function PressureBearingSection({
  bearing,
  title = 'Pressure distribution (auto)',
}: {
  bearing: CalculationResult;
  title?: string;
}) {
  if (!bearing?.steps?.length) return null;
  const nestedDiagram = (bearing as CalculationResult & { pressure_diagram_data?: PressureDiagramData })
    .pressure_diagram_data;
  const depthRows = extractDepthTable(bearing.summary ?? {});
  return (
    <div className="mt-4 border-t border-infra-accent/30 pt-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">{title}</h3>
      {nestedDiagram && <PressureDiagram data={nestedDiagram} />}
      {depthRows && <DepthTable rows={depthRows} />}
      <ResultsDisplay result={bearing} pressureDiagram={nestedDiagram} />
    </div>
  );
}

import { useState } from 'react';
import type { CalculationResult, CalculationStatus } from '../../types/calculations';

interface ResultsDisplayProps {
  result: CalculationResult;
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

export function ResultsDisplay({ result }: ResultsDisplayProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1]));

  const toggleStep = (stepNum: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNum)) next.delete(stepNum);
      else next.add(stepNum);
      return next;
    });
  };

  return (
    <div className="space-y-3">
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
        {Object.entries(result.summary ?? {}).map(([key, value]) => (
          <div key={key} className="flex justify-between text-xs mt-1">
            <span className="text-gray-500">{key.replace(/_/g, ' ')}</span>
            <span className="text-gray-200">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
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

        return (
          <div
            key={step.step_number}
            className={`border rounded-lg overflow-hidden cursor-pointer ${STATUS_COLORS[status]}`}
            onClick={() => toggleStep(step.step_number)}
          >
            <div className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  Step {step.step_number}: {step.title}
                </span>
                <span className="text-gray-600 text-xs">{isExpanded ? '▼' : '▶'}</span>
              </div>

              {isExpanded && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-mono text-infra-highlight/80">{step.formula}</p>
                  <p className="text-xs text-gray-400">{step.substitution}</p>
                  <p className={`text-xs font-semibold ${RESULT_COLORS[status]}`}>
                    {step.result}
                  </p>
                  {step.reference && (
                    <p className="text-xs text-gray-600 text-right">Ref: {step.reference}</p>
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

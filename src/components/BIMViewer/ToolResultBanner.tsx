import { usePlatformToolsStore } from '../../store/platformToolsStore';

export function ToolResultBanner() {
  const { lastResult, lastError, isRunning, runningAction, clearResult } = usePlatformToolsStore();

  if (!lastResult && !lastError && !isRunning) return null;

  return (
    <div className="px-5 py-2.5 bg-infra-dark/95 border-b border-infra-accent/20 flex items-center gap-4 text-sm z-20 min-h-[2.5rem]">
      {isRunning && (
        <span className="text-amber-300 animate-pulse">Running {runningAction}…</span>
      )}
      {lastError && (
        <span className="text-red-300 flex-1 truncate" title={lastError}>
          Error: {lastError}
        </span>
      )}
      {lastResult && !isRunning && (
        <span className="text-infra-highlight flex-1 truncate" title={lastResult.summary}>
          <strong>{lastResult.label}:</strong> {lastResult.summary}
        </span>
      )}
      <button
        type="button"
        onClick={clearResult}
        className="text-gray-500 hover:text-white px-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

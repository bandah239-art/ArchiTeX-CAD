import { useMeasureStore } from '../../store/measureStore';

export function MeasureResultBanner() {
  const { areaResult, volumeResult, measureError, areaPoints, clearMeasure } = useMeasureStore();

  if (!areaResult && !volumeResult && !measureError && areaPoints.length === 0) return null;

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
      <div className="bg-slate-900/95 border border-amber-500/40 rounded-lg px-4 py-2 text-xs shadow-lg min-w-[240px] max-w-md">
        {areaPoints.length > 0 && !areaResult && (
          <div className="text-amber-200">
            Area measure: {areaPoints.length} point{areaPoints.length !== 1 ? 's' : ''} — double-click or Enter to close polygon · Esc to cancel
          </div>
        )}
        {areaResult && (
          <div className="text-emerald-300">
            <strong>Area:</strong> {areaResult.areaM2.toFixed(2)} m² · Perimeter {areaResult.perimeterM.toFixed(2)} m
            <span className="text-gray-500 ml-1">({areaResult.source})</span>
          </div>
        )}
        {volumeResult && (
          <div className="text-sky-300">
            <strong>{volumeResult.name}</strong> · Vol {volumeResult.volumeM3.toFixed(3)} m³ · Area{' '}
            {volumeResult.surfaceAreaM2.toFixed(2)} m²
            <span className="text-gray-500 ml-1">({volumeResult.source})</span>
          </div>
        )}
        {measureError && <div className="text-red-300">{measureError}</div>}
        <button
          type="button"
          onClick={clearMeasure}
          className="absolute top-1 right-1 text-gray-500 hover:text-white px-1"
          aria-label="Clear measure"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

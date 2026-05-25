import { useViewerStore } from '../../store/viewerStore';
import { entityIdFromExpressId } from '../../services/ifcMeshXeokit';

export function BoxSelectPanel() {
  const {
    resolvedBoxSelection,
    viewerControls,
    selectEntityById,
    clearBoxSelectResults,
    selectElement,
  } = useViewerStore();

  if (!resolvedBoxSelection.length) return null;

  return (
    <div className="border-t border-infra-accent/30 bg-infra-darker/80 p-2 max-h-52 overflow-y-auto">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wide text-emerald-400 font-semibold">
          Box select ({resolvedBoxSelection.length})
        </span>
        <button
          type="button"
          onClick={() => {
            clearBoxSelectResults();
            viewerControls?.showAll();
          }}
          className="text-[10px] text-gray-500 hover:text-white"
        >
          Clear
        </button>
      </div>
      <ul className="space-y-0.5">
        {resolvedBoxSelection.map((el) => {
          const entityId = entityIdFromExpressId(el.id);
          const typeLabel = el.type.replace(/^Ifc/, '');
          const qty =
            el.volume != null
              ? `${el.volume.toFixed(2)} m³`
              : el.area != null
                ? `${el.area.toFixed(1)} m²`
                : null;
          return (
            <li key={entityId}>
              <button
                type="button"
                className="w-full text-left text-[11px] text-gray-300 hover:text-emerald-300 truncate px-1 py-1 rounded hover:bg-infra-accent/20"
                onClick={() => {
                  selectEntityById(entityId);
                  selectElement(el);
                  viewerControls?.highlightEntities([entityId]);
                }}
              >
                <span className="text-emerald-500/80 font-medium">{typeLabel}</span>
                <span className="text-gray-500 mx-1">·</span>
                <span>{el.name || entityId}</span>
                {qty && <span className="text-gray-600 ml-1">({qty})</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

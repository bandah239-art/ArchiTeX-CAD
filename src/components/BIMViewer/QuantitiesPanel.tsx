import { useMemo } from 'react';
import { useIfcModelStore } from '../../store/ifcModelStore';
import { buildAssetCatalog } from '../../services/ifcAssetCatalog';
import { useBoQStore } from '../../store/boqStore';
import { toBimPayload } from '../../services/ifcBoqService';

export function QuantitiesPanel() {
  const { elements, elementByEntityId, getBoqElements } = useIfcModelStore();
  const { importFromBim, isImportingBim } = useBoQStore();

  const catalog = useMemo(
    () => buildAssetCatalog(elements, elementByEntityId),
    [elements, elementByEntityId]
  );

  const boqElements = getBoqElements();

  if (!catalog.length) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        Load an IFC model to extract quantity takeoff from solid geometry.
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-3">Quantity Takeoff</h2>
      <p className="text-xs text-gray-500 mb-4">
        Volumes and areas computed from mesh solids — not placeholder dimensions.
      </p>

      <div className="space-y-2 mb-4">
        {catalog.map((cat) => (
          <div
            key={cat.type}
            className="flex items-center justify-between text-xs bg-infra-darker/50 rounded px-3 py-2 border border-infra-accent/20"
          >
            <div>
              <span className="text-gray-200 font-medium">{cat.label}</span>
              <span className="text-gray-600 ml-2">×{cat.count}</span>
            </div>
            <div className="text-right">
              {cat.totalVolume > 0 && (
                <div className="text-emerald-400">{cat.totalVolume.toFixed(3)} m³</div>
              )}
              {cat.totalArea > 0 && (
                <div className="text-sky-400">{cat.totalArea.toFixed(2)} m²</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={isImportingBim || !boqElements.length}
        onClick={() => importFromBim(toBimPayload(boqElements))}
        className="w-full py-2 text-xs font-semibold uppercase tracking-wide rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isImportingBim ? 'Importing…' : `Push ${boqElements.length} elements → BoQ`}
      </button>
    </div>
  );
}

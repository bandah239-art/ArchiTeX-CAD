import { useMemo } from 'react';
import { useIfcModelStore } from '../../store/ifcModelStore';
import { useViewerStore } from '../../store/viewerStore';
import { buildAssetCatalog, modelTotals } from '../../services/ifcAssetCatalog';

function AssetIcon({ icon, color }: { icon: string; color: string }) {
  const stroke = color;
  if (icon === 'wall') {
    return (
      <svg viewBox="0 0 48 32" className="w-full h-full" fill="none">
        <rect x="4" y="8" width="40" height="16" stroke={stroke} strokeWidth="2" rx="1" />
        <line x1="4" y1="16" x2="44" y2="16" stroke={stroke} strokeWidth="1" opacity="0.5" />
      </svg>
    );
  }
  if (icon === 'slab') {
    return (
      <svg viewBox="0 0 48 32" className="w-full h-full" fill="none">
        <rect x="6" y="12" width="36" height="8" fill={stroke} opacity="0.3" stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }
  if (icon === 'column') {
    return (
      <svg viewBox="0 0 48 32" className="w-full h-full" fill="none">
        <rect x="20" y="4" width="8" height="24" fill={stroke} opacity="0.4" stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }
  if (icon === 'beam') {
    return (
      <svg viewBox="0 0 48 32" className="w-full h-full" fill="none">
        <rect x="4" y="14" width="40" height="6" fill={stroke} opacity="0.4" stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }
  if (icon === 'opening') {
    return (
      <svg viewBox="0 0 48 32" className="w-full h-full" fill="none">
        <rect x="14" y="6" width="20" height="20" stroke={stroke} strokeWidth="2" />
        <line x1="14" y1="26" x2="34" y2="6" stroke={stroke} strokeWidth="1" opacity="0.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 32" className="w-full h-full" fill="none">
      <rect x="8" y="8" width="32" height="16" stroke={stroke} strokeWidth="2" strokeDasharray="4 2" />
    </svg>
  );
}

export function AssetsPanel() {
  const { elements, elementByEntityId } = useIfcModelStore();
  const { selectedAssetType, selectAssetType, viewerControls } = useViewerStore();

  const catalog = useMemo(
    () => buildAssetCatalog(elements, elementByEntityId),
    [elements, elementByEntityId]
  );
  const totals = useMemo(() => modelTotals(catalog), [catalog]);

  if (!catalog.length) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        <div className="text-3xl mb-3 opacity-30">📦</div>
        Open an IFC model to see detected assets and quantities
      </div>
    );
  }

  const handleSelect = (asset: (typeof catalog)[0]) => {
    selectAssetType(asset.type);
    viewerControls?.highlightEntities(asset.entityIds);
  };

  const handleIsolate = (asset: (typeof catalog)[0]) => {
    selectAssetType(asset.type);
    viewerControls?.isolateEntities(asset.entityIds);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-infra-accent/20">
        <div className="rounded-lg bg-violet-900/40 border border-violet-500/30 p-2 mb-3">
          <div className="text-[10px] font-bold text-violet-300 uppercase tracking-wide">BIM Detection</div>
          <p className="text-[10px] text-violet-200/70 mt-1 leading-relaxed">
            Elements detected from IFC geometry with solid-derived quantities.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-infra-darker/60 rounded p-2">
            <div className="text-lg font-bold text-white">{totals.elementCount}</div>
            <div className="text-[9px] text-gray-500 uppercase">Elements</div>
          </div>
          <div className="bg-infra-darker/60 rounded p-2">
            <div className="text-lg font-bold text-emerald-400">{totals.totalVolume.toFixed(1)}</div>
            <div className="text-[9px] text-gray-500 uppercase">m³ Volume</div>
          </div>
          <div className="bg-infra-darker/60 rounded p-2">
            <div className="text-lg font-bold text-sky-400">{totals.totalArea.toFixed(0)}</div>
            <div className="text-[9px] text-gray-500 uppercase">m² Area</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Assets</h3>
        <div className="grid grid-cols-2 gap-2">
          {catalog.map((asset) => {
            const selected = selectedAssetType === asset.type;
            return (
              <button
                key={asset.type}
                type="button"
                onClick={() => handleSelect(asset)}
                onDoubleClick={() => handleIsolate(asset)}
                className={`relative rounded-lg border p-2 text-left transition-all hover:scale-[1.02] ${
                  selected
                    ? 'border-emerald-500/60 bg-emerald-900/20 ring-1 ring-emerald-500/40'
                    : 'border-infra-accent/30 bg-infra-darker/50 hover:border-infra-accent/50'
                }`}
                title="Click to highlight · Double-click to isolate"
              >
                <span className="absolute top-1.5 right-1.5 text-[10px] font-bold text-white bg-black/50 rounded px-1.5 py-0.5">
                  {asset.count}
                </span>
                <div className="h-10 mb-2 opacity-80">
                  <AssetIcon icon={asset.icon} color={asset.color} />
                </div>
                <div className="text-[11px] font-medium text-gray-200 truncate">{asset.label}</div>
                {asset.totalVolume > 0 && (
                  <div className="text-[9px] text-gray-500 mt-0.5">{asset.totalVolume.toFixed(2)} m³</div>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[9px] text-gray-600 mt-3 text-center">
          Double-click asset to isolate in 3D view
        </p>
      </div>
    </div>
  );
}

import { useViewerStore } from '../../store/viewerStore';

export function LayerPanel() {
  const { layerTypes, hiddenTypes, toggleType, showAllLayers } = useViewerStore();

  if (!layerTypes.length) {
    return (
      <div className="p-3 border-t border-infra-accent/20">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Layers</h3>
        <p className="text-[10px] text-gray-600">Layers appear when a model is loaded</p>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-infra-accent/20">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase">Layers</h3>
        {hiddenTypes.length > 0 && (
          <button
            type="button"
            onClick={showAllLayers}
            className="text-[9px] text-emerald-400 hover:text-emerald-300"
          >
            Show all
          </button>
        )}
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {layerTypes.map((layer) => {
          const visible = !hiddenTypes.includes(layer);
          return (
            <label
              key={layer}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={visible}
                onChange={() => toggleType(layer)}
                className="rounded border-infra-accent/50"
              />
              {layer.replace('Ifc', '')}
            </label>
          );
        })}
      </div>
    </div>
  );
}

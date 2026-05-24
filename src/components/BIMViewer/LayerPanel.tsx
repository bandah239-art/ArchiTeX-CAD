import { useViewerStore } from '../../store/viewerStore';

const DEFAULT_LAYERS = [
  'IfcWall',
  'IfcSlab',
  'IfcBeam',
  'IfcColumn',
  'IfcDoor',
  'IfcWindow',
  'IfcStair',
  'IfcRoof',
];

export function LayerPanel() {
  const { visibleTypes, toggleType } = useViewerStore();

  return (
    <div className="p-3 border-t border-infra-accent/20">
      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Layers</h3>
      <div className="space-y-1">
        {DEFAULT_LAYERS.map((layer) => {
          const visible = visibleTypes.length === 0 || visibleTypes.includes(layer);
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

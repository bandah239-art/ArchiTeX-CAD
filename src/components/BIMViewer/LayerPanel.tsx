import { useViewerStore } from '../../store/viewerStore';
import { usePlatformToolsStore } from '../../store/platformToolsStore';
import { syncGeoOverlaysToViewer } from '../../services/geoOverlayEngine';
import { useGeoStore } from '../../store/geoStore';
import { useDrawStore } from '../../store/drawStore';
import type { OverlayLayerId } from '../../services/selectionBridge';

const OVERLAY_LABELS: Record<OverlayLayerId, string> = {
  sketchLayer: 'Sketches',
  geoOverlay: 'Geo overlays',
  measure: 'Measurements',
};

export function LayerPanel() {
  const {
    layerTypes,
    hiddenTypes,
    hiddenOverlays,
    toggleType,
    toggleOverlay,
    showAllLayers,
  } = useViewerStore();
  const terrainResult = usePlatformToolsStore((s) => s.terrainResult);
  const floodResult = useGeoStore((s) => s.floodResult);
  const geoVis = usePlatformToolsStore((s) => s.geoOverlayVisibility);
  const setGeoVis = usePlatformToolsStore.setState;
  const floorElevation = useDrawStore((s) => s.floorElevation);

  const setGeoSubLayer = (key: 'showTerrain' | 'showContours' | 'showFlood', on: boolean) => {
    const next = { ...geoVis, [key]: on };
    setGeoVis({ geoOverlayVisibility: next });
    syncGeoOverlaysToViewer(terrainResult, floodResult, {
      floorY: floorElevation,
      ...next,
    });
  };

  const hasIfcLayers = layerTypes.length > 0;
  const hasHidden = hiddenTypes.length > 0 || hiddenOverlays.length > 0;

  return (
    <div className="p-3 border-t border-infra-accent/20">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-400 uppercase">Layers</h3>
        {hasHidden && (
          <button
            type="button"
            onClick={showAllLayers}
            className="text-[9px] text-emerald-400 hover:text-emerald-300"
          >
            Show all
          </button>
        )}
      </div>

      {!hasIfcLayers && (
        <p className="text-[10px] text-gray-600 mb-2">IFC layers appear when a model is loaded</p>
      )}

      {hasIfcLayers && (
        <div className="space-y-1 max-h-36 overflow-y-auto mb-3">
          <p className="text-[9px] text-gray-600 uppercase tracking-wide mb-1">IFC model</p>
          {layerTypes.map((layer) => {
            const visible = !hiddenTypes.includes(layer);
            return (
              <LayerCheckbox
                key={layer}
                label={layer.replace(/^Ifc/, '')}
                checked={visible}
                onChange={() => toggleType(layer)}
              />
            );
          })}
        </div>
      )}

      <div className="space-y-1 border-t border-infra-accent/15 pt-2">
        <p className="text-[9px] text-gray-600 uppercase tracking-wide mb-1">Scene overlays</p>
        {(Object.keys(OVERLAY_LABELS) as OverlayLayerId[]).map((layer) => (
          <LayerCheckbox
            key={layer}
            label={OVERLAY_LABELS[layer]}
            checked={!hiddenOverlays.includes(layer)}
            onChange={() => toggleOverlay(layer)}
          />
        ))}
      </div>

      {(terrainResult || floodResult) && (
        <div className="space-y-1 border-t border-infra-accent/15 pt-2 mt-2">
          <p className="text-[9px] text-gray-600 uppercase tracking-wide mb-1">Geo analysis</p>
          {terrainResult && (
            <>
              <LayerCheckbox
                label="Terrain"
                checked={geoVis.showTerrain}
                onChange={() => setGeoSubLayer('showTerrain', !geoVis.showTerrain)}
              />
              <LayerCheckbox
                label="Contours"
                checked={geoVis.showContours}
                onChange={() => setGeoSubLayer('showContours', !geoVis.showContours)}
              />
            </>
          )}
          {floodResult && (
            <LayerCheckbox
              label="Flood depth"
              checked={geoVis.showFlood}
              onChange={() => setGeoSubLayer('showFlood', !geoVis.showFlood)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function LayerCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="rounded border-infra-accent/50"
      />
      {label}
    </label>
  );
}

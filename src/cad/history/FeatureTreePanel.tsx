import { useFeatureTreeStore } from '../../store/featureTreeStore';
import { useDrawStore } from '../../store/drawStore';
import { occAPI } from '../../services/occAPI';
import { getGeometricEntities } from '../../services/cadToolHandlers';

export function FeatureTreePanel() {
  const {
    features,
    selectedFeatureId,
    isRebuilding,
    rebuildTree,
    addFeature,
    removeFeature,
    updateFeatureInputs,
    selectFeature
  } = useFeatureTreeStore();

  const drawStore = useDrawStore();

  const handleAddSketch = () => {
    // Collect active sketch elements as entities
    const activeElements = drawStore.elements;
    const id = `sketch_${Date.now()}`;
    addFeature({
      id,
      type: 'sketch',
      name: `Sketch_${features.filter(f => f.type === 'sketch').length + 1}`,
      inputs: { entities: getGeometricEntities(activeElements) },
      dependencies: [],
      output: null,
      status: 'needs_rebuild',
      error: null
    });
  };

  const handleAddExtrude = () => {
    const sketches = features.filter(f => f.type === 'sketch');
    if (sketches.length === 0) {
      alert("Please add a Sketch feature first.");
      return;
    }
    const id = `extrude_${Date.now()}`;
    addFeature({
      id,
      type: 'extrude',
      name: `Extrude_${features.filter(f => f.type === 'extrude').length + 1}`,
      inputs: {
        sketch_id: sketches[sketches.length - 1].id,
        height: 3000
      },
      dependencies: [sketches[sketches.length - 1].id],
      output: null,
      status: 'needs_rebuild',
      error: null
    });
  };

  const handleAddPocket = () => {
    const solids = features.filter(f => f.type === 'extrude' || f.type === 'pocket');
    const sketches = features.filter(f => f.type === 'sketch');
    if (solids.length === 0 || sketches.length === 0) {
      alert("Requires at least one Extrude feature and one profile Sketch.");
      return;
    }
    const id = `pocket_${Date.now()}`;
    addFeature({
      id,
      type: 'pocket',
      name: `Pocket_${features.filter(f => f.type === 'pocket').length + 1}`,
      inputs: {
        base_id: solids[solids.length - 1].id,
        sketch_id: sketches[sketches.length - 1].id,
        depth: 500
      },
      dependencies: [solids[solids.length - 1].id, sketches[sketches.length - 1].id],
      output: null,
      status: 'needs_rebuild',
      error: null
    });
  };

  const handleAddFillet = () => {
    const solids = features.filter(f => f.type === 'extrude' || f.type === 'pocket' || f.type === 'fillet');
    if (solids.length === 0) {
      alert("Requires at least one solid feature to apply a fillet.");
      return;
    }
    const id = `fillet_${Date.now()}`;
    addFeature({
      id,
      type: 'fillet',
      name: `Fillet_${features.filter(f => f.type === 'fillet').length + 1}`,
      inputs: {
        shape_id: solids[solids.length - 1].id,
        radius: 50
      },
      dependencies: [solids[solids.length - 1].id],
      output: null,
      status: 'needs_rebuild',
      error: null
    });
  };

  const handleExportSTEP = async () => {
    // Export the last built solid feature
    const solids = features.filter(f => f.status === 'built' && f.type !== 'sketch');
    if (solids.length === 0) {
      alert("No built 3D solids available to export.");
      return;
    }
    const lastSolid = solids[solids.length - 1];
    
    // We fetch the sketch dependency to export
    const sketchId = lastSolid.inputs.sketch_id;
    const sketch = features.find(f => f.id === sketchId);
    if (!sketch || !sketch.inputs.entities) {
      alert("Missing parent sketch elements for export.");
      return;
    }
    
    try {
      await occAPI.exportSTEP(sketch.inputs.entities, lastSolid.inputs.height || 3000);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    }
  };

  const selectedFeature = features.find(f => f.id === selectedFeatureId);

  return (
    <div className="flex flex-col h-full bg-infra-darker text-gray-200 border-l border-infra-accent/20">
      {/* Header */}
      <div className="p-4 border-b border-infra-accent/20">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Parametric History Tree</h2>
        <p className="text-[10px] text-gray-500 mt-1">Rebuilds geometry in topological sequence</p>
      </div>

      {/* Feature List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {features.length === 0 ? (
          <div className="text-xs text-gray-600 text-center py-8">
            No features in tree. Add a sketch to begin.
          </div>
        ) : (
          features.map(f => {
            const statusColors = {
              built: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
              needs_rebuild: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
              error: 'text-red-400 border-red-500/20 bg-red-500/5'
            };
            const statusIcons = {
              built: '✓',
              needs_rebuild: '⚠',
              error: '✗'
            };
            
            const isSelected = f.id === selectedFeatureId;
            return (
              <div
                key={f.id}
                onClick={() => selectFeature(f.id)}
                className={`flex flex-col p-2.5 rounded border text-xs cursor-pointer transition-all duration-200 ${
                  isSelected ? 'border-infra-accent bg-infra-accent/10' : 'border-gray-800 bg-infra-dark/40 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusColors[f.status]}`}>
                      {statusIcons[f.status]} {f.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="font-semibold text-white">{f.name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFeature(f.id);
                    }}
                    className="text-gray-600 hover:text-red-400 text-xs px-1"
                  >
                    Remove
                  </button>
                </div>
                
                {f.error && (
                  <span className="text-[10px] text-red-400 mt-1 block bg-red-950/20 px-2 py-1 rounded border border-red-900/30">
                    Error: {f.error}
                  </span>
                )}
                
                {f.type === 'extrude' && f.inputs.height && (
                  <span className="text-[10px] text-gray-500 mt-1">Height: {f.inputs.height} mm</span>
                )}
                {f.type === 'pocket' && f.inputs.depth && (
                  <span className="text-[10px] text-gray-500 mt-1">Depth: {f.inputs.depth} mm</span>
                )}
                {f.type === 'fillet' && f.inputs.radius && (
                  <span className="text-[10px] text-gray-500 mt-1">Radius: {f.inputs.radius} mm</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Editor Panel */}
      {selectedFeature && (
        <div className="p-4 border-t border-infra-accent/20 bg-infra-dark/60">
          <h3 className="text-xs font-semibold text-white uppercase mb-3">Edit {selectedFeature.name}</h3>
          <div className="space-y-3">
            {selectedFeature.type === 'extrude' && (
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Height (mm)</label>
                <input
                  type="number"
                  defaultValue={selectedFeature.inputs.height || 3000}
                  onBlur={(e) => updateFeatureInputs(selectedFeature.id, { height: Number(e.target.value) })}
                  className="w-full bg-infra-darker border border-infra-accent/30 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-infra-accent"
                />
              </div>
            )}

            {selectedFeature.type === 'pocket' && (
              <>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Depth (mm)</label>
                  <input
                    type="number"
                    defaultValue={selectedFeature.inputs.depth || 500}
                    onBlur={(e) => updateFeatureInputs(selectedFeature.id, { depth: Number(e.target.value) })}
                    className="w-full bg-infra-darker border border-infra-accent/30 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-infra-accent"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-1">Profile Sketch ID</label>
                  <select
                    defaultValue={selectedFeature.inputs.sketch_id}
                    onChange={(e) => updateFeatureInputs(selectedFeature.id, { sketch_id: e.target.value })}
                    className="w-full bg-infra-darker border border-infra-accent/30 rounded px-2 py-1 text-xs text-white focus:outline-none"
                  >
                    {features.filter(f => f.type === 'sketch').map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {selectedFeature.type === 'fillet' && (
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Radius (mm)</label>
                <input
                  type="number"
                  defaultValue={selectedFeature.inputs.radius || 50}
                  onBlur={(e) => updateFeatureInputs(selectedFeature.id, { radius: Number(e.target.value) })}
                  className="w-full bg-infra-darker border border-infra-accent/30 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-infra-accent"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ribbon Actions & Controls */}
      <div className="p-4 border-t border-infra-accent/20 space-y-3 bg-infra-dark/20">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleAddSketch}
            className="bg-infra-accent/10 hover:bg-infra-accent/20 border border-infra-accent/30 text-white text-[11px] rounded py-1.5 font-medium transition"
          >
            + Add Sketch
          </button>
          <button
            onClick={handleAddExtrude}
            className="bg-infra-accent/10 hover:bg-infra-accent/20 border border-infra-accent/30 text-white text-[11px] rounded py-1.5 font-medium transition"
          >
            + Add Extrude
          </button>
          <button
            onClick={handleAddPocket}
            className="bg-infra-accent/10 hover:bg-infra-accent/20 border border-infra-accent/30 text-white text-[11px] rounded py-1.5 font-medium transition"
          >
            + Add Pocket
          </button>
          <button
            onClick={handleAddFillet}
            className="bg-infra-accent/10 hover:bg-infra-accent/20 border border-infra-accent/30 text-white text-[11px] rounded py-1.5 font-medium transition"
          >
            + Add Fillet
          </button>
        </div>

        <div className="border-t border-infra-accent/10 pt-3 flex gap-2">
          <button
            onClick={rebuildTree}
            disabled={isRebuilding}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded shadow transition disabled:opacity-50"
          >
            {isRebuilding ? 'Rebuilding...' : 'REBUILD ALL'}
          </button>
          <button
            onClick={handleExportSTEP}
            className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold py-2 px-3 rounded shadow transition"
          >
            EXPORT STEP
          </button>
        </div>
      </div>
    </div>
  );
}

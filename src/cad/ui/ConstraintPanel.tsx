import { useState } from 'react';
import { useSketchConstraintStore, semanticRef } from '../../store/sketchConstraintStore';
import { useDrawStore } from '../../store/drawStore';
import { useCadSessionStore } from '../../store/cadSessionStore';

export function ConstraintPanel() {
  const {
    constraints,
    solverResult,
    dofAnalysis,
    addGeometric,
    remove: removeConstraint,
    clearAll,
    solveConstraints
  } = useSketchConstraintStore();

  const { elements, selectedId, removeElement } = useDrawStore();
  const [renameValue, setRenameValue] = useState('');

  const selectedElement = elements.find((e) => e.id === selectedId);
  const selectedName = selectedElement ? (semanticRef.resolveIdToName(selectedElement.id) ?? selectedElement.label ?? selectedElement.id) : '';

  // Active status parsing
  let statusText = 'UNDER CONSTRAINED';
  let statusColor = 'text-amber-400';
  let totalDOF = 0;

  if (dofAnalysis) {
    totalDOF = dofAnalysis.totalDOF;
    if (dofAnalysis.status === 'fully_constrained') {
      statusText = 'FULLY CONSTRAINED ✓';
      statusColor = 'text-emerald-400';
    } else if (dofAnalysis.status === 'over_constrained') {
      statusText = 'OVER CONSTRAINED ⚠';
      statusColor = 'text-red-400';
    }
  }

  if (solverResult && !solverResult.converged) {
    statusText = 'CONFLICT / ERR ⚠';
    statusColor = 'text-red-500 font-bold';
  }

  const handleAddGeometric = (type: any) => {
    useCadSessionStore.getState().setStep(0, { constraintType: type, alignIds: [] });
    useCadSessionStore.getState().startCommand('param-geom');
    useCadSessionStore.getState().setHint(`Pick entities for ${type}.`);
  };

  const handleAddDimensional = (type: any) => {
    const valStr = window.prompt(`Enter value for ${type}:`, '5');
    if (valStr == null) return;
    const value = parseFloat(valStr);
    if (isNaN(value)) return;

    useCadSessionStore.getState().setStep(0, { constraintType: type, alignIds: [] });
    useDrawStore.setState({ modifiers: { ...useDrawStore.getState().modifiers, offsetDistance: value } });
    useCadSessionStore.getState().startCommand('param-dim');
    useCadSessionStore.getState().setHint(`Pick entities for ${type} (${value}).`);
  };

  const handleRename = () => {
    if (!selectedElement || !renameValue.trim()) return;
    const oldName = selectedName;
    const newName = renameValue.trim();
    if (oldName === newName) return;

    const success = semanticRef.rename(oldName, newName);
    if (success) {
      selectedElement.label = newName;
      setRenameValue('');
      solveConstraints();
    } else {
      alert('Rename failed. Name might already be taken.');
    }
  };

  const handleToggleFix = () => {
    if (!selectedId) return;
    const hasFix = constraints.some(c => c.type === 'fix' && c.elementIds.includes(selectedId));
    if (hasFix) {
      // Find the fix constraint and remove it
      const fixCon = constraints.find(c => c.type === 'fix' && c.elementIds.includes(selectedId));
      if (fixCon) {
        removeConstraint(fixCon.id);
      }
    } else {
      addGeometric('fix', [selectedId]);
    }
  };

  const handleDeleteElement = () => {
    if (selectedId) {
      removeElement(selectedId);
      // Remove all constraints involving this element
      const toRemove = constraints.filter(c => c.elementIds.includes(selectedId));
      toRemove.forEach(c => removeConstraint(c.id));
      solveConstraints();
    }
  };

  const getElementDisplayName = (id: string) => {
    return semanticRef.resolveIdToName(id) ?? id;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/50 rounded-xl text-slate-200 p-4 shadow-2xl text-sm overflow-y-auto select-none">
      <div className="font-bold text-base text-white tracking-wider mb-2 uppercase border-b border-slate-700 pb-2">
        Sketch Constraints
      </div>

      {/* Solver status */}
      <div className="mb-4 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
        <div className="flex justify-between items-center mb-1">
          <span className="text-gray-400 font-medium">Solver Status:</span>
          <span className={`font-semibold tracking-wide ${statusColor}`}>{statusText}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>Degrees of Freedom (DOF):</span>
          <span className={totalDOF === 0 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
            {totalDOF}
          </span>
        </div>
      </div>

      {/* Active constraints */}
      <div className="flex-1 min-h-[140px] mb-4">
        <div className="font-semibold text-xs text-gray-400 uppercase tracking-wider mb-2">
          Active Constraints ({constraints.length})
        </div>
        {constraints.length === 0 ? (
          <div className="text-xs text-gray-500 italic p-3 bg-slate-950/20 rounded border border-dashed border-slate-800 text-center">
            No constraints applied yet.
          </div>
        ) : (
          <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {constraints.map((c) => {
              const isConflicting = solverResult && !solverResult.converged && solverResult.conflicts.some(x => x.id === c.id);
              return (
                <li
                  key={c.id}
                  className={`flex justify-between items-center p-2 rounded text-xs border ${
                    isConflicting
                      ? 'bg-red-500/10 border-red-500/30 text-red-300'
                      : 'bg-slate-950/30 border-slate-800/80 hover:bg-slate-950/50'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>{isConflicting ? '⚠' : '✓'}</span>
                    <span className="font-medium text-slate-300">
                      {c.elementIds.map(id => getElementDisplayName(id)).join(', ')}
                    </span>
                    <span className="text-slate-500">—</span>
                    <span className="capitalize text-slate-400">
                      {c.type.replace('_', ' ')}
                      {c.value != null && `: ${c.value}mm`}
                    </span>
                  </span>
                  <button
                    type="button"
                    title="Remove constraint"
                    className="text-gray-500 hover:text-red-400 transition-colors px-1"
                    onClick={() => removeConstraint(c.id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Action buttons */}
      <div className="mb-4">
        <div className="font-semibold text-xs text-gray-400 uppercase tracking-wider mb-2">
          Add Constraint
        </div>
        <div className="grid grid-cols-3 gap-1 mb-2">
          {(['horizontal', 'vertical', 'coincident', 'parallel', 'perpendicular', 'equal'] as const).map((type) => (
            <button
              key={type}
              type="button"
              className="py-1.5 px-2 text-xs bg-indigo-600/15 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-200 rounded capitalize transition-colors font-medium text-center"
              onClick={() => handleAddGeometric(type === 'equal' ? 'equal' : type)}
            >
              {type}
            </button>
          ))}
          {(['distance', 'angle', 'tangent'] as const).map((type) => (
            <button
              key={type}
              type="button"
              className="py-1.5 px-2 text-xs bg-indigo-600/15 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-200 rounded capitalize transition-colors font-medium text-center"
              onClick={() => {
                if (type === 'tangent') {
                  handleAddGeometric('tangent');
                } else {
                  handleAddDimensional(type);
                }
              }}
            >
              {type}
            </button>
          ))}
        </div>
        {constraints.length > 0 && (
          <button
            type="button"
            className="w-full text-center py-1.5 text-xs bg-slate-950/40 hover:bg-slate-950/70 border border-slate-700/50 text-gray-400 hover:text-white rounded transition-colors"
            onClick={clearAll}
          >
            Clear All Constraints
          </button>
        )}
      </div>

      {/* Selected Entity Manager */}
      <div className="border-t border-slate-800 pt-3 mt-auto">
        <div className="font-semibold text-xs text-gray-400 uppercase tracking-wider mb-2">
          Selected Geometry
        </div>
        {selectedElement ? (
          <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-3 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Selected ID:</span>
              <span className="font-mono text-slate-300 text-[10px]">{selectedElement.id}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Semantic Name:</span>
              <span className="font-semibold text-white">{selectedName}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-500">Degrees of Freedom:</span>
              <span className="font-medium text-amber-400">
                {dofAnalysis?.perEntity.get(selectedElement.id) ?? 0}
              </span>
            </div>

            {/* Rename input */}
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="Rename e.g. wall_edge"
                className="flex-1 min-w-0 bg-slate-950/80 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
              />
              <button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded px-2.5 py-1 text-xs transition-colors"
                onClick={handleRename}
              >
                Rename
              </button>
            </div>

            {/* Entity Actions */}
            <div className="flex gap-1">
              <button
                type="button"
                className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded py-1.5 text-xs transition-colors"
                onClick={handleToggleFix}
              >
                {constraints.some(c => c.type === 'fix' && c.elementIds.includes(selectedElement.id)) ? 'Unfix' : 'Fix Location'}
              </button>
              <button
                type="button"
                className="flex-1 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 hover:border-red-500/40 text-red-300 rounded py-1.5 text-xs transition-colors"
                onClick={handleDeleteElement}
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500 italic p-3 text-center bg-slate-950/10 rounded border border-dashed border-slate-850">
            Select a point or line on the canvas to edit.
          </div>
        )}
      </div>
    </div>
  );
}

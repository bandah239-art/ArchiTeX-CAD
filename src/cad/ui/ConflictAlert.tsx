import { useSketchConstraintStore, semanticRef } from '../../store/sketchConstraintStore';

export function ConflictAlert() {
  const { solverResult } = useSketchConstraintStore();

  if (!solverResult || solverResult.converged) return null;

  const getElementDisplayName = (id: string) => {
    return semanticRef.resolveIdToName(id) ?? id;
  };

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 max-w-md w-full px-4 animate-bounce">
      <div className="bg-red-950/90 backdrop-blur border border-red-500 text-red-200 p-3 rounded-lg shadow-xl text-xs space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-red-400">
          <span className="text-sm">⚠</span>
          <span>GEOMETRIC CONSTRAINT CONFLICT</span>
        </div>
        <p className="text-gray-300">
          The solver could not converge. The system is over-constrained or has conflicting rules:
        </p>
        <ul className="list-disc pl-4 space-y-1 text-red-300 font-mono text-[10px]">
          {solverResult.conflicts.map((c) => (
            <li key={c.id}>
              {c.type.replace('_', ' ').toUpperCase()} on {c.entities.map(id => getElementDisplayName(id)).join(', ')}
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-gray-400 italic pt-1">
          Try deleting one of the conflicting constraints to resolve the sketch.
        </p>
      </div>
    </div>
  );
}

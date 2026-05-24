import { useViewerStore } from '../../store/viewerStore';
import { useIfcModelStore } from '../../store/ifcModelStore';

export function ModelTree() {
  const { loadedModel } = useViewerStore();
  const { stats } = useIfcModelStore();

  return (
    <div className="p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Model Tree</h3>
      <div id="treeViewContainer" className="text-xs text-gray-400 min-h-[40px]" />
      {loadedModel ? (
        <div className="text-xs text-gray-400 mt-2 space-y-1">
          <div className="font-medium text-gray-300">{loadedModel.name}</div>
          <p>{loadedModel.elementCount} elements</p>
          {stats && stats.triangleCount > 0 && (
            <p className="text-gray-600">{(stats.triangleCount / 1000).toFixed(1)}k triangles</p>
          )}
          {stats && stats.loadTime > 0 && (
            <p className="text-gray-600">Loaded in {(stats.loadTime / 1000).toFixed(1)}s</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-600 mt-2">No model loaded</p>
      )}
    </div>
  );
}

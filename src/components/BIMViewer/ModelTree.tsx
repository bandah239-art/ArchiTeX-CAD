import { useViewerStore } from '../../store/viewerStore';
import { useIfcModelStore } from '../../store/ifcModelStore';

export function ModelTree() {
  const { loadedModel } = useViewerStore();
  const { stats } = useIfcModelStore();

  return (
    <div className="p-4">
      <h3 className="workspace-subheading mb-3 border-0 pb-0">Model Tree</h3>
      <div id="treeViewContainer" className="text-sm text-gray-300 min-h-[48px]" />
      {loadedModel ? (
        <div className="text-sm text-gray-400 mt-3 space-y-1.5">
          <div className="font-medium text-gray-200">{loadedModel.name}</div>
          <p>{loadedModel.elementCount} elements</p>
          {stats && stats.triangleCount > 0 && (
            <p className="text-gray-500">{(stats.triangleCount / 1000).toFixed(1)}k triangles</p>
          )}
          {stats && stats.loadTime > 0 && (
            <p className="text-gray-500">Loaded in {(stats.loadTime / 1000).toFixed(1)}s</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500 mt-3">No model loaded</p>
      )}
    </div>
  );
}

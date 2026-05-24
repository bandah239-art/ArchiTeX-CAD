import { useViewerStore } from '../../store/viewerStore';

export function ModelTree() {
  const { loadedModel } = useViewerStore();

  return (
    <div className="p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Model Tree</h3>
      <div id="treeViewContainer" className="text-xs text-gray-400 min-h-[40px]" />
      {loadedModel ? (
        <div className="text-xs text-gray-400 mt-2">
          <div className="font-medium text-gray-300 mb-1">{loadedModel.name}</div>
          <p className="text-gray-600">{loadedModel.elementCount} elements</p>
        </div>
      ) : (
        <p className="text-xs text-gray-600 mt-2">No model loaded</p>
      )}
    </div>
  );
}

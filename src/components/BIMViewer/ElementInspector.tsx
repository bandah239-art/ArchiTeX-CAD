import type { IFCElement } from '../../types/ifc';
import { useViewerStore } from '../../store/viewerStore';
import { SelectionActions } from './SelectionActions';
import { calcModuleForIfcType } from '../../services/selectionBridge';

interface ElementInspectorProps {
  element: IFCElement | null;
}

export function ElementInspector({ element }: ElementInspectorProps) {
  const boxCount = useViewerStore((s) => s.resolvedBoxSelection.length);

  if (!element && boxCount === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        <div className="text-3xl mb-3 opacity-30">🔍</div>
        <p>Click an IFC element or box-select to inspect and run platform actions.</p>
      </div>
    );
  }

  if (!element && boxCount > 0) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-white mb-3 uppercase tracking-wide">
          Multi-selection
        </h2>
        <SelectionActions element={null} />
        <p className="text-xs text-gray-500 mt-3">
          Click a row in the box-select list to set the primary element for single-element actions.
        </p>
      </div>
    );
  }

  if (!element) return null;

  const calcLinked = calcModuleForIfcType(element.type);

  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold text-white mb-3 uppercase tracking-wide">
        Element Inspector
      </h2>

      <SelectionActions element={element} />

      <section className="mb-5">
        <h3 className="text-xs text-gray-500 uppercase mb-2">IFC Properties</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Element ID" value={element.id} />
          <Row label="Type" value={element.type.replace(/^Ifc/, '')} />
          <Row label="Name" value={element.name} />
          <Row label="Global ID" value={element.globalId} />
          {element.material && <Row label="Material" value={element.material} />}
          {element.storey && <Row label="Storey" value={element.storey} />}
          {element.length != null && <Row label="Length" value={`${element.length.toFixed(3)} m`} />}
          {element.width != null && <Row label="Width" value={`${element.width.toFixed(3)} m`} />}
          {element.height != null && <Row label="Height" value={`${element.height.toFixed(3)} m`} />}
          {element.volume != null && <Row label="Volume" value={`${element.volume.toFixed(3)} m³`} />}
          {element.area != null && <Row label="Area" value={`${element.area.toFixed(3)} m²`} />}
          {element.weight != null && <Row label="Weight (est.)" value={`${element.weight} kg`} />}
        </dl>
      </section>

      <section className="mb-5">
        <h3 className="text-xs text-gray-500 uppercase mb-2">Structural</h3>
        {calcLinked ? (
          <p className="text-xs text-emerald-400/90">
            Linked calculator: <span className="font-medium">{calcLinked}</span> — use Actions above.
          </p>
        ) : (
          <p className="text-xs text-gray-600 italic">No structural calculator mapped for this IFC type.</p>
        )}
      </section>

      <section>
        <h3 className="text-xs text-gray-500 uppercase mb-2">User Properties</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Status" value={element.status || 'pending'} />
          <Row label="Notes" value={element.notes || '—'} />
          <Row label="Specification" value={element.specification || '—'} />
          {element.costRate != null && (
            <Row label="Cost Rate" value={`R ${element.costRate}/m³`} />
          )}
        </dl>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-500 flex-shrink-0">{label}</dt>
      <dd className="text-gray-200 text-right truncate">{value}</dd>
    </div>
  );
}

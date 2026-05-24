import type { IFCElement } from '../../types/ifc';

interface ElementInspectorProps {
  element: IFCElement | null;
}

export function ElementInspector({ element }: ElementInspectorProps) {
  if (!element) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        <div className="text-3xl mb-3 opacity-30">🔍</div>
        Click an element in the 3D viewer to inspect its properties
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold text-white mb-4 uppercase tracking-wide">
        Element Inspector
      </h2>

      <section className="mb-6">
        <h3 className="text-xs text-gray-500 uppercase mb-2">IFC Properties</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Element ID" value={element.id} />
          <Row label="Type" value={element.type} />
          <Row label="Name" value={element.name} />
          <Row label="Global ID" value={element.globalId} />
          {element.material && <Row label="Material" value={element.material} />}
          {element.storey && <Row label="Storey" value={element.storey} />}
          {element.length != null && <Row label="Length" value={`${element.length} m`} />}
          {element.width != null && <Row label="Width" value={`${element.width} m`} />}
          {element.height != null && <Row label="Height" value={`${element.height} m`} />}
          {element.volume != null && <Row label="Volume" value={`${element.volume} m³`} />}
          {element.area != null && <Row label="Area" value={`${element.area} m²`} />}
          {element.weight != null && <Row label="Weight (est.)" value={`${element.weight} kg`} />}
        </dl>
      </section>

      <section className="mb-6">
        <h3 className="text-xs text-gray-500 uppercase mb-2">Structural Properties</h3>
        <p className="text-xs text-gray-600 italic">No calculations linked to this element</p>
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

import { useEffect, useState } from 'react';
import { geometryExtensionsAPI, type GeometryExtensionsStatus } from '../../services/geometryExtensionsAPI';

export function GeometryKernelPanel() {
  const [status, setStatus] = useState<GeometryExtensionsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    geometryExtensionsAPI
      .status()
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : 'Status unavailable'));
  }, []);

  if (error) {
    return (
      <div className="p-4 text-xs text-red-300">
        Geometry kernel offline — start Python server ({error})
      </div>
    );
  }

  if (!status) {
    return <div className="p-4 text-xs text-gray-500">Loading geometry kernel…</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-2">Geometry Kernel</h2>
      <p className="text-[10px] text-gray-500 mb-3">{status.source}</p>

      <div className="space-y-2 mb-4">
        <Row label="2D regions" value={status.engines['2d_regions']} />
        <Row label="3D mesh" value={status.engines['3d_mesh']} />
        <Row
          label="AutoCAD native"
          value={status.engines.autocad_native ? 'Available' : 'Stub (build bridge)'}
        />
      </div>

      <h3 className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Capabilities</h3>
      <ul className="text-[10px] text-gray-500 space-y-1 list-disc list-inside">
        {status.capabilities.map((c) => (
          <li key={c}>{c.replace(/_/g, ' ')}</li>
        ))}
      </ul>

      <p className="text-[9px] text-gray-600 mt-4 leading-relaxed">
        Gile GeometryExtensions C# library is ported to Python for IFC/BoQ workflows. Optional
        AutoCAD bridge in GeometryExtensions/InfraAfricaBridge (ARCHITEX-CAD) for native DWG when ObjectARX is installed.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs bg-infra-darker/50 rounded px-2 py-1.5 border border-infra-accent/20">
      <span className="text-gray-400">{label}</span>
      <span className="text-emerald-400 font-medium">{value}</span>
    </div>
  );
}

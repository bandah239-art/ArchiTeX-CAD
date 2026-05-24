import { useGovernmentStore } from '../../store/governmentStore';
import { SCurveChart } from './PortfolioDashboard';

interface ProjectTrackerProps {
  onBack: () => void;
}

export function ProjectTracker({ onBack }: ProjectTrackerProps) {
  const { selectedProject, isLoading } = useGovernmentStore();
  if (isLoading || !selectedProject) {
    return <div className="p-4 text-xs text-gray-400">Loading project...</div>;
  }

  const evm = selectedProject.evm as Record<string, number> | undefined;
  const sCurve = selectedProject.s_curve as { planned: { month: number; planned_pct: number }[]; actual: { month: number; actual_pct: number }[]; spi: number } | undefined;
  const snapshots = (selectedProject.snapshots as Record<string, unknown>[]) ?? [];
  const certificates = (selectedProject.certificates as Record<string, unknown>[]) ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30 flex items-center gap-2">
        <button type="button" onClick={onBack} className="text-xs text-gray-400 hover:text-white">← Back</button>
        <h2 className="text-sm font-bold text-white uppercase tracking-wide truncate">{String(selectedProject.project_name)}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs text-gray-300">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Contract" value={`USD ${Number(selectedProject.contract_value_usd).toLocaleString()}`} />
          <Metric label="Complete" value={`${selectedProject.completion_pct}%`} />
          <Metric label="SPI" value={String(evm?.SPI ?? '—')} />
          <Metric label="CPI" value={String(evm?.CPI ?? '—')} />
        </div>

        {evm && (
          <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded">
            <div className="text-gray-400 uppercase mb-2">EVM Analysis — {evm.status}</div>
            <div className="grid grid-cols-2 gap-1">
              <span>PV: USD {evm.PV?.toLocaleString()}</span>
              <span>EV: USD {evm.EV?.toLocaleString()}</span>
              <span>AC: USD {evm.AC?.toLocaleString()}</span>
              <span>EAC: USD {evm.EAC?.toLocaleString()}</span>
            </div>
          </div>
        )}

        {sCurve && (
          <div>
            <div className="text-gray-400 uppercase mb-1">S-Curve (SPI {sCurve.spi})</div>
            <SCurveChart planned={sCurve.planned} actual={sCurve.actual} />
          </div>
        )}

        <div>
          <div className="text-gray-400 uppercase mb-1">Progress Snapshots ({snapshots.length})</div>
          {snapshots.slice(-3).map((s) => (
            <div key={String(s.id)} className="py-1 border-b border-infra-accent/20">
              {String(s.snapshot_date)} — {Number(s.completion_pct)}% · USD {Number(s.expenditure_usd).toLocaleString()}
            </div>
          ))}
        </div>

        <div>
          <div className="text-gray-400 uppercase mb-1">Payment Certificates ({certificates.length})</div>
          {certificates.length === 0 && <div className="text-gray-500">No certificates yet</div>}
          {certificates.map((c) => (
            <div key={String(c.id)} className="py-1">
              Cert #{Number(c.certificate_no)} — USD {Number(c.net_certificate).toLocaleString()} ({String(c.status)})
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-infra-darker border border-infra-accent/30 rounded">
      <div className="text-gray-500">{label}</div>
      <div className="text-white font-medium">{value}</div>
    </div>
  );
}

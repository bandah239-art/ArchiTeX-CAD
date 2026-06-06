import { useState } from 'react';
import { useGovernmentStore } from '../../store/governmentStore';
import { SCurveChart, EVMChart } from './PortfolioDashboard';

interface ProjectTrackerProps {
  onBack: () => void;
}

export function ProjectTracker({ onBack }: ProjectTrackerProps) {
  const { selectedProject, isLoading, addSnapshot, generateCertificate, approveCertificate } = useGovernmentStore();

  if (isLoading || !selectedProject) {
    return <div className="p-4 text-xs text-gray-400">Loading project...</div>;
  }

  const evm = selectedProject.evm as Record<string, number> | undefined;
  const sCurve = selectedProject.s_curve as {
    planned: { month: number; planned_pct: number }[];
    actual: { month: number; actual_pct: number }[];
    evm_series?: { month: number; PV: number; EV: number; AC: number }[];
    spi: number;
  } | undefined;
  const snapshots = (selectedProject.snapshots as Record<string, unknown>[]) ?? [];
  const certificates = (selectedProject.certificates as Record<string, unknown>[]) ?? [];
  const statusLog = (selectedProject.status_log as Record<string, unknown>[]) ?? [];
  const cashflow = selectedProject.cashflow as Record<string, unknown> | undefined;

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
          <Metric label="SPI" value={String(evm?.SPI ?? '—')} alert={Number(evm?.SPI) < 0.85} />
          <Metric label="CPI" value={String(evm?.CPI ?? '—')} alert={Number(evm?.CPI) < 0.85} />
        </div>

        {evm && (
          <div className={`p-3 border rounded ${evm.status === 'CRITICAL' ? 'bg-red-950/30 border-red-500/40' : 'bg-infra-darker border-infra-accent/30'}`}>
            <div className="text-gray-400 uppercase mb-2">EVM Analysis — {evm.status}</div>
            <div className="grid grid-cols-2 gap-1">
              <span>PV: USD {evm.PV?.toLocaleString()}</span>
              <span>EV: USD {evm.EV?.toLocaleString()}</span>
              <span>AC: USD {evm.AC?.toLocaleString()}</span>
              <span>EAC: USD {evm.EAC?.toLocaleString()}</span>
              <span>CV: USD {evm.CV?.toLocaleString()}</span>
              <span>SV: USD {evm.SV?.toLocaleString()}</span>
            </div>
          </div>
        )}

        {sCurve?.evm_series && sCurve.evm_series.length > 0 && (
          <div>
            <div className="text-gray-400 uppercase mb-1">EVM S-Curve (PV / EV / AC)</div>
            <EVMChart series={sCurve.evm_series} budget={Number(selectedProject.contract_value_usd)} />
          </div>
        )}

        {sCurve && (
          <div>
            <div className="text-gray-400 uppercase mb-1">Progress S-Curve (SPI {sCurve.spi})</div>
            <SCurveChart planned={sCurve.planned} actual={sCurve.actual} />
          </div>
        )}

        {cashflow?.cash_deficit_alert && (
          <div className="p-2 bg-amber-950/40 border border-amber-500/40 rounded text-amber-200">
            Cash deficit alert — forecast exceeds contract by 5%+
          </div>
        )}

        <SnapshotForm onSubmit={addSnapshot} />
        <CertificateForm
          contractValue={Number(selectedProject.contract_value_usd)}
          prevGross={Number(certificates.at(-1)?.gross_amount ?? 0)}
          onSubmit={generateCertificate}
        />

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
            <div key={String(c.id)} className="py-2 border-b border-infra-accent/20 space-y-1">
              <div>
                {String(c.certificate_ref ?? `Cert #${c.certificate_no}`)} — USD {Number(c.net_certificate).toLocaleString()} ({String(c.status)})
              </div>
              {c.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => approveCertificate(String(c.id), 'engineer_approved', 'Resident Engineer', 'engineer')}
                  className="text-[10px] px-2 py-0.5 bg-blue-800/50 rounded"
                >
                  Engineer Approve
                </button>
              )}
              {c.status === 'engineer_approved' && (
                <button
                  type="button"
                  onClick={() => approveCertificate(String(c.id), 'ready_for_payment', 'Client Rep', 'client')}
                  className="text-[10px] px-2 py-0.5 bg-emerald-800/50 rounded"
                >
                  Client Approve → Ready for Payment
                </button>
              )}
            </div>
          ))}
        </div>

        {statusLog.length > 0 && (
          <div>
            <div className="text-gray-400 uppercase mb-1">Status History</div>
            {statusLog.slice(0, 5).map((l) => (
              <div key={String(l.id)} className="text-[10px] text-gray-500">
                {String(l.changed_at).slice(0, 10)}: {String(l.old_status || '—')} → {String(l.new_status)} ({String(l.changed_by)})
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SnapshotForm({ onSubmit }: { onSubmit: (p: Record<string, unknown>) => Promise<void> }) {
  const [pct, setPct] = useState('0');
  const [spend, setSpend] = useState('0');
  return (
    <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded space-y-2">
      <div className="text-gray-400 uppercase">Add Progress Snapshot</div>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="Completion %" className="px-2 py-1 bg-infra-darker border border-infra-accent/40 rounded text-white" />
        <input type="number" value={spend} onChange={(e) => setSpend(e.target.value)} placeholder="Expenditure USD" className="px-2 py-1 bg-infra-darker border border-infra-accent/40 rounded text-white" />
      </div>
      <button type="button" onClick={() => onSubmit({ completion_pct: parseFloat(pct), expenditure_usd: parseFloat(spend) })} className="w-full py-1.5 bg-infra-accent/40 rounded text-white">
        Record Snapshot
      </button>
    </div>
  );
}

function CertificateForm({
  contractValue,
  prevGross,
  onSubmit,
}: {
  contractValue: number;
  prevGross: number;
  onSubmit: (p: Record<string, unknown>) => Promise<void>;
}) {
  const [works, setWorks] = useState('0');
  const [materials, setMaterials] = useState('0');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  return (
    <div className="p-3 bg-infra-darker border border-blue-500/30 rounded space-y-2">
      <div className="text-gray-400 uppercase">Generate Interim Certificate</div>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2 py-1 bg-infra-darker border border-infra-accent/40 rounded text-white" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2 py-1 bg-infra-darker border border-infra-accent/40 rounded text-white" />
        <input type="number" value={works} onChange={(e) => setWorks(e.target.value)} placeholder="Works USD" className="px-2 py-1 bg-infra-darker border border-infra-accent/40 rounded text-white" />
        <input type="number" value={materials} onChange={(e) => setMaterials(e.target.value)} placeholder="Materials USD" className="px-2 py-1 bg-infra-darker border border-infra-accent/40 rounded text-white" />
      </div>
      <button
        type="button"
        onClick={() =>
          onSubmit({
            contract_value_usd: contractValue,
            previous_cumulative_gross_usd: prevGross,
            works_value_usd: parseFloat(works),
            materials_on_site_usd: parseFloat(materials),
            period_from: from,
            period_to: to,
          })
        }
        className="w-full py-1.5 bg-blue-900/50 rounded text-white"
      >
        Generate IPC
      </button>
    </div>
  );
}

function Metric({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`p-2 border rounded ${alert ? 'bg-red-950/30 border-red-500/40' : 'bg-infra-darker border-infra-accent/30'}`}>
      <div className="text-gray-500">{label}</div>
      <div className={`font-medium ${alert ? 'text-red-300' : 'text-white'}`}>{value}</div>
    </div>
  );
}

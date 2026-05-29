import { useState } from 'react';
import { API_BASE } from '../../../services/apiConfig';

interface BoQItem { code: string; description: string; unit: string; qty: number; rate_zmw: number; }
interface VerifyResult {
  status: string;
  items: { code: string; description: string; unit: string; submitted_qty: number; verified_qty: number; submitted_total: number; verified_total: number; variance_pct: number; risk: string }[];
  summary: { total_items: number; pass: number; warning: number; fail: number; submitted_total_zmw: number; verified_total_zmw: number; overpriced_by_zmw: number };
  audit_hash: string;
}

const RISK_CLS: Record<string, string> = {
  pass:    'text-green-300 bg-green-900/20',
  warning: 'text-yellow-300 bg-yellow-900/20',
  fail:    'text-red-300 bg-red-900/20',
};

const DEMO_VERIFIED: BoQItem[] = [
  { code: 'A.1', description: 'Excavation to foundation', unit: 'm³', qty: 45, rate_zmw: 850 },
  { code: 'B.1', description: 'C25 concrete in footings', unit: 'm³', qty: 12, rate_zmw: 4200 },
  { code: 'B.2', description: 'Y16 reinforcement bars', unit: 'kg', qty: 850, rate_zmw: 22 },
];
const DEMO_SUBMITTED: BoQItem[] = [
  { code: 'A.1', description: 'Excavation to foundation', unit: 'm³', qty: 48, rate_zmw: 850 },
  { code: 'B.1', description: 'C25 concrete in footings', unit: 'm³', qty: 15.5, rate_zmw: 4200 },
  { code: 'B.2', description: 'Y16 reinforcement bars', unit: 'kg', qty: 920, rate_zmw: 22 },
];

function ItemTable({
  title,
  items,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  items: BoQItem[];
  onChange: (i: number, field: keyof BoQItem, v: string | number) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  const CLS = 'px-1 py-0.5 text-xs bg-infra-darker border border-infra-accent/30 rounded text-white w-full focus:outline-none';
  return (
    <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-bold text-white">{title}</h4>
        <button type="button" onClick={onAdd} className="text-xs px-2 py-0.5 border border-infra-highlight/50 rounded text-infra-highlight hover:bg-infra-highlight/10">+ Row</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-max">
          <thead>
            <tr className="text-gray-500">
              <th className="text-left py-0.5 pr-1 font-semibold">Code</th>
              <th className="text-left py-0.5 pr-1 font-semibold">Description</th>
              <th className="text-left py-0.5 pr-1 font-semibold">Unit</th>
              <th className="text-right py-0.5 pr-1 font-semibold">Qty</th>
              <th className="text-right py-0.5 pr-1 font-semibold">Rate (ZMW)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td className="pr-1 py-0.5"><input className={CLS} style={{ width: 52 }} value={item.code} onChange={(e) => onChange(i, 'code', e.target.value)} /></td>
                <td className="pr-1 py-0.5"><input className={CLS} style={{ width: 140 }} value={item.description} onChange={(e) => onChange(i, 'description', e.target.value)} /></td>
                <td className="pr-1 py-0.5"><input className={CLS} style={{ width: 44 }} value={item.unit} onChange={(e) => onChange(i, 'unit', e.target.value)} /></td>
                <td className="pr-1 py-0.5"><input type="number" className={`${CLS} text-right`} style={{ width: 60 }} value={item.qty} onChange={(e) => onChange(i, 'qty', Number(e.target.value))} /></td>
                <td className="pr-1 py-0.5"><input type="number" className={`${CLS} text-right`} style={{ width: 70 }} value={item.rate_zmw} onChange={(e) => onChange(i, 'rate_zmw', Number(e.target.value))} /></td>
                <td><button type="button" onClick={() => onRemove(i)} className="text-red-500 hover:text-red-400 px-1">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function BoQVerifierCalculator() {
  const [verified, setVerified] = useState<BoQItem[]>(DEMO_VERIFIED);
  const [submitted, setSubmitted] = useState<BoQItem[]>(DEMO_SUBMITTED);
  const [tolerance, setTolerance] = useState(15);
  const [projectName, setProjectName] = useState('');
  const [contractor, setContractor] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(list: BoQItem[], setter: (items: BoQItem[]) => void, i: number, field: keyof BoQItem, v: string | number) {
    setter(list.map((item, idx) => idx === i ? { ...item, [field]: v } : item));
  }

  function addRow(list: BoQItem[], setter: (items: BoQItem[]) => void) {
    setter([...list, { code: '', description: '', unit: 'm³', qty: 0, rate_zmw: 0 }]);
  }

  async function verify() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/verification/compare-boq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: projectName || 'Project',
          contractor_name: contractor || 'Contractor',
          tolerance_pct: tolerance,
          verified_items: verified,
          submitted_items: submitted,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const sum = result?.summary;
  const overallStatus = result?.status ?? '';
  const OVERALL_CLS = overallStatus === 'pass' ? 'bg-green-900/30 border-green-700/50 text-green-300'
    : overallStatus === 'warning' ? 'bg-yellow-900/30 border-yellow-700/50 text-yellow-300'
    : overallStatus ? 'bg-red-900/30 border-red-700/50 text-red-300'
    : '';

  return (
    <div className="flex flex-col space-y-4 bg-infra-bg/50 p-4 border border-infra-accent/30 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">BoQ Verifier</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">ZMW</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Project Name</label>
          <input className="w-full px-2 py-1.5 text-xs bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Contractor</label>
          <input className="w-full px-2 py-1.5 text-xs bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none" value={contractor} onChange={(e) => setContractor(e.target.value)} placeholder="Optional" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Tolerance: ±{tolerance}%</label>
        <input type="range" min={5} max={50} step={5} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className="w-full accent-infra-highlight" />
      </div>

      <ItemTable
        title="Verified (Engineer's) Quantities"
        items={verified}
        onChange={(i, f, v) => updateRow(verified, setVerified, i, f, v)}
        onAdd={() => addRow(verified, setVerified)}
        onRemove={(i) => setVerified(verified.filter((_, idx) => idx !== i))}
      />

      <ItemTable
        title="Submitted (Contractor's) Quantities"
        items={submitted}
        onChange={(i, f, v) => updateRow(submitted, setSubmitted, i, f, v)}
        onAdd={() => addRow(submitted, setSubmitted)}
        onRemove={(i) => setSubmitted(submitted.filter((_, idx) => idx !== i))}
      />

      <button
        type="button"
        onClick={verify}
        disabled={loading}
        className="w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-infra-highlight/80 disabled:opacity-50"
      >
        {loading ? 'VERIFYING...' : 'VERIFY BOQ'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      {result && sum && (
        <div className="space-y-3">
          {/* Overall status */}
          <div className={`p-3 rounded border text-center font-bold uppercase text-sm ${OVERALL_CLS}`}>
            {result.status.toUpperCase()} — {sum.pass} pass · {sum.warning} warning · {sum.fail} fail
          </div>

          {/* Financial summary */}
          <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Submitted total</span>
              <span className="text-white font-mono">ZMW {sum.submitted_total_zmw.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Verified total</span>
              <span className="text-white font-mono">ZMW {sum.verified_total_zmw.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs border-t border-infra-accent/20 pt-1">
              <span className="text-gray-400">Overpriced by</span>
              <span className={`font-mono font-bold ${sum.overpriced_by_zmw > 0 ? 'text-red-300' : 'text-green-300'}`}>
                ZMW {sum.overpriced_by_zmw.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Line items */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="text-gray-500 border-b border-infra-accent/30">
                  <th className="text-left py-1 pr-2 font-semibold">Code</th>
                  <th className="text-left py-1 pr-2 font-semibold">Description</th>
                  <th className="text-right py-1 pr-2 font-semibold">Verified</th>
                  <th className="text-right py-1 pr-2 font-semibold">Submitted</th>
                  <th className="text-right py-1 pr-2 font-semibold">Var%</th>
                  <th className="text-center py-1 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item, i) => (
                  <tr key={i} className="border-b border-infra-accent/10">
                    <td className="py-0.5 pr-2 text-gray-400">{item.code}</td>
                    <td className="py-0.5 pr-2 text-gray-300 max-w-[120px] truncate">{item.description}</td>
                    <td className="py-0.5 pr-2 text-right font-mono">{item.verified_qty}</td>
                    <td className="py-0.5 pr-2 text-right font-mono">{item.submitted_qty}</td>
                    <td className={`py-0.5 pr-2 text-right font-mono font-bold ${item.variance_pct > 0 ? 'text-red-300' : 'text-green-300'}`}>{item.variance_pct > 0 ? '+' : ''}{item.variance_pct}%</td>
                    <td className="py-0.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${RISK_CLS[item.risk] ?? ''}`}>{item.risk}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-gray-600 italic">Audit hash: {result.audit_hash.slice(0, 16)}…</p>
        </div>
      )}
    </div>
  );
}

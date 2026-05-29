import { useState, useCallback } from 'react';
import { useBoQStore } from '../../store/boqStore';
import { anchorDocument, anchorBadge, type AnchorRecord } from '../../services/blockchainAnchor';
import { API_BASE } from '../../services/apiConfig';

interface SubmittedItem {
  id: string;
  code: string;
  description: string;
  unit: string;
  qty: number;
  rate_zmw: number;
}

interface VerifiedLine {
  code: string;
  description: string;
  unit: string;
  submitted_qty: number;
  verified_qty: number;
  submitted_total: number;
  verified_total: number;
  variance_pct: number;
  risk: 'pass' | 'warning' | 'fail';
}

const RISK_STYLE: Record<VerifiedLine['risk'], string> = {
  pass:    'bg-emerald-900/20 text-emerald-300 border-emerald-800/40',
  warning: 'bg-yellow-900/20 text-yellow-300 border-yellow-800/40',
  fail:    'bg-red-900/20 text-red-300 border-red-800/40',
};

const RISK_LABEL: Record<VerifiedLine['risk'], string> = {
  pass:    '✓ PASS',
  warning: '⚠ CHECK',
  fail:    '✗ INFLATE',
};

const TEMPLATE = `F10,Concrete block wall 230mm,m²,450,85
E10,RC slab C25 t=175mm,m³,52.5,2100
E30,HY steel reinforcement Y12,Tonne,4.2,12500
E20,Soffit formwork,m²,280,320
D20,Pipe trench excavation,m³,180,120
R12,HDPE pipe 110mm supply,m,320,250`;

export function QuantityVerifier() {
  const { sketchBoQItems, compiledBoQ } = useBoQStore();

  const [rawInput, setRawInput]             = useState('');
  const [, setSubmitted]                    = useState<SubmittedItem[]>([]);
  const [results, setResults]               = useState<VerifiedLine[] | null>(null);
  const [loading, setLoading]               = useState(false);
  const [anchor, setAnchor]                 = useState<AnchorRecord | null>(null);
  const [parseError, setParseError]         = useState<string | null>(null);
  const [tolerance, setTolerance]           = useState(15);
  const [projectName, setProjectName]       = useState('');
  const [contractorName, setContractorName] = useState('');

  // Build verified quantities from sketch BOQ or compiled BOQ
  const verifiedMap = new Map<string, { qty: number; unit: string; description: string; rate: number }>();

  for (const item of sketchBoQItems) {
    verifiedMap.set(item.code.toLowerCase(), {
      qty: item.qty,
      unit: item.unit,
      description: item.description,
      rate: item.rate_zmw,
    });
  }

  if (compiledBoQ) {
    const sections = (compiledBoQ as { sections?: unknown[] }).sections ?? [];
    for (const sec of sections) {
      const items = (sec as { items?: unknown[] }).items ?? [];
      for (const it of items) {
        const i = it as { code?: string; description?: string; unit?: string; quantity?: number; rate_zmw?: number };
        if (i.code) {
          verifiedMap.set(i.code.toLowerCase(), {
            qty:         i.quantity ?? 0,
            unit:        i.unit ?? 'item',
            description: i.description ?? i.code,
            rate:        i.rate_zmw ?? 0,
          });
        }
      }
    }
  }

  const parseInput = useCallback(() => {
    setParseError(null);
    const lines = rawInput.trim().split('\n').filter(Boolean);
    const items: SubmittedItem[] = [];
    for (const line of lines) {
      const [code, description, unit, qty, rate] = line.split(',').map((s) => s.trim());
      if (!code || !qty) continue;
      if (isNaN(Number(qty))) { setParseError(`Invalid qty on: ${line}`); return; }
      items.push({
        id: `sub-${items.length}`,
        code,
        description: description ?? code,
        unit: unit ?? 'item',
        qty: Number(qty),
        rate_zmw: Number(rate ?? 0),
      });
    }
    setSubmitted(items);
    return items;
  }, [rawInput]);

  const runVerification = useCallback(async () => {
    const items = parseInput();
    if (!items?.length) { setParseError('No valid items found. Use format: code,description,unit,qty,rate'); return; }
    setLoading(true);

    try {
      // Try backend first
      const res = await fetch(`${API_BASE}/verification/compare-boq`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name:    projectName || 'Project',
          contractor_name: contractorName || 'Contractor',
          tolerance_pct:   tolerance,
          verified_items:  Array.from(verifiedMap.entries()).map(([code, v]) => ({ code, ...v })),
          submitted_items: items,
        }),
      }).catch(() => null);

      let lines: VerifiedLine[];

      if (res?.ok) {
        const data = await res.json();
        lines = data.items;
      } else {
        // Client-side fallback — compare by code
        lines = items.map((sub) => {
          const ver = verifiedMap.get(sub.code.toLowerCase());
          const verified_qty = ver?.qty ?? 0;
          const variance_pct = verified_qty > 0
            ? ((sub.qty - verified_qty) / verified_qty) * 100
            : 0;
          const risk: VerifiedLine['risk'] =
            Math.abs(variance_pct) <= tolerance        ? 'pass'
            : Math.abs(variance_pct) <= tolerance * 2  ? 'warning'
            : 'fail';
          return {
            code:            sub.code,
            description:     sub.description,
            unit:            sub.unit,
            submitted_qty:   sub.qty,
            verified_qty:    ver?.qty ?? 0,
            submitted_total: sub.qty * sub.rate_zmw,
            verified_total:  (ver?.qty ?? 0) * sub.rate_zmw,
            variance_pct:    +variance_pct.toFixed(1),
            risk,
          };
        });
      }

      setResults(lines);

      // Anchor the report
      const rec = await anchorDocument({
        data: {
          project: projectName,
          contractor: contractorName,
          items: lines,
          timestamp: Date.now(),
        },
        document_type:    'quantity_verification_report',
        document_summary: `${lines.length} items, ${lines.filter((l) => l.risk === 'fail').length} failures`,
        project:          projectName,
      });
      setAnchor(rec);

    } finally {
      setLoading(false);
    }
  }, [parseInput, verifiedMap, tolerance, projectName, contractorName]);

  const fails    = results?.filter((r) => r.risk === 'fail').length ?? 0;
  const warnings = results?.filter((r) => r.risk === 'warning').length ?? 0;
  const passes   = results?.filter((r) => r.risk === 'pass').length ?? 0;
  const subTotal = results?.reduce((s, r) => s + r.submitted_total, 0) ?? 0;
  const verTotal = results?.reduce((s, r) => s + r.verified_total, 0) ?? 0;
  const overallRisk = fails > 0 ? 'fail' : warnings > 0 ? 'warning' : results ? 'pass' : null;

  const printReport = () => {
    const w = window.open('', '_blank');
    if (!w || !results) return;
    const rows = results.map((r) => `
      <tr style="color:${r.risk==='fail'?'#f87171':r.risk==='warning'?'#fbbf24':'#4ade80'}">
        <td>${r.code}</td><td>${r.description}</td><td>${r.unit}</td>
        <td style="text-align:right">${r.submitted_qty.toFixed(2)}</td>
        <td style="text-align:right">${r.verified_qty.toFixed(2)}</td>
        <td style="text-align:right;font-weight:bold">${r.variance_pct > 0 ? '+' : ''}${r.variance_pct}%</td>
        <td style="text-align:center;font-weight:bold">${RISK_LABEL[r.risk]}</td>
      </tr>`).join('');
    w.document.write(`<!DOCTYPE html><html><head><title>Quantity Verification Report — ${projectName}</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px}
    h1{font-size:16px;margin:0}h2{font-size:12px;color:#555;margin:4px 0 16px}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:4px 6px}
    th{background:#1e293b;color:#fff}.badge{padding:3px 8px;border-radius:4px;font-size:10px}
    .fail{background:#fee2e2}.warning{background:#fef3c7}.pass{background:#dcfce7}
    .summary{display:flex;gap:16px;margin:12px 0}.kpi{background:#f8fafc;padding:8px 12px;border-radius:6px;text-align:center}
    .kpi-val{font-size:20px;font-weight:bold}.kpi-lbl{font-size:10px;color:#666}
    .anchor{font-size:9px;color:#888;margin-top:20px;padding-top:8px;border-top:1px solid #eee}
    @media print{.no-print{display:none}}</style></head><body>
    <h1>QUANTITY VERIFICATION REPORT</h1>
    <h2>${projectName} — Contractor: ${contractorName} — ${new Date().toLocaleDateString()}</h2>
    <div class="summary">
      <div class="kpi"><div class="kpi-val" style="color:#f87171">${fails}</div><div class="kpi-lbl">FAIL (>${tolerance}%)</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#fbbf24">${warnings}</div><div class="kpi-lbl">CHECK (>${Math.round(tolerance/2)}%)</div></div>
      <div class="kpi"><div class="kpi-val" style="color:#4ade80">${passes}</div><div class="kpi-lbl">PASS</div></div>
      <div class="kpi"><div class="kpi-val">ZMW ${subTotal.toLocaleString()}</div><div class="kpi-lbl">Submitted Total</div></div>
      <div class="kpi"><div class="kpi-val">ZMW ${verTotal.toLocaleString()}</div><div class="kpi-lbl">Verified Total</div></div>
      <div class="kpi"><div class="kpi-val" style="color:${subTotal>verTotal?'#f87171':'#4ade80'}">ZMW ${Math.abs(subTotal-verTotal).toLocaleString()}</div><div class="kpi-lbl">${subTotal>verTotal?'Overpriced':'Underpriced'}</div></div>
    </div>
    <table><thead><tr><th>Code</th><th>Description</th><th>Unit</th><th>Submitted Qty</th><th>Verified Qty</th><th>Variance</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody></table>
    ${anchor ? `<div class="anchor">🔗 Verification Hash: ${anchorBadge(anchor)}</div>` : ''}
    <div class="anchor">Generated by InFra_TeCh Platform — For official use, certify with EIZ-registered engineer signature</div>
    <script>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">🔍 Quantity Verifier</h2>
        <p className="text-[10px] text-gray-500 mt-1">Compare contractor BOQ against independently calculated quantities. Flags inflation above tolerance.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Project info */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Project name</label>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Kafue Clinic Phase 1"
              className="w-full text-xs bg-infra-darker border border-infra-accent/40 rounded px-2 py-1.5 text-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Contractor</label>
            <input value={contractorName} onChange={(e) => setContractorName(e.target.value)}
              placeholder="e.g. XYZ Construction"
              className="w-full text-xs bg-infra-darker border border-infra-accent/40 rounded px-2 py-1.5 text-white" />
          </div>
        </div>

        {/* Tolerance */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-400">Tolerance ±</label>
          <input type="number" min={5} max={50} step={5} value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            className="w-16 text-xs bg-infra-darker border border-infra-accent/40 rounded px-2 py-1 text-white" />
          <span className="text-xs text-gray-500">% — items beyond this threshold are flagged FAIL</span>
        </div>

        {/* Verified source */}
        <div className="p-3 rounded border border-emerald-700/40 bg-emerald-900/10 text-xs">
          <p className="text-emerald-300 font-semibold mb-1">Verified Quantities Source</p>
          {sketchBoQItems.length > 0
            ? <p className="text-gray-400">{sketchBoQItems.length} items from sketch drawing (Phase 2 BOQ)</p>
            : <p className="text-amber-400">No sketch BOQ found. Draw elements and run "📐→💰" in the BIM tab first, or the verifier will flag all items as unverified.</p>
          }
        </div>

        {/* Contractor BOQ input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-400 font-medium">Paste Contractor BOQ — CSV format: code, description, unit, qty, rate_zmw</label>
            <button type="button" onClick={() => setRawInput(TEMPLATE)}
              className="text-[10px] text-infra-highlight hover:underline">Load example</button>
          </div>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            rows={7}
            placeholder={'F10,Concrete block wall 230mm,m²,450,85\nE10,RC slab C25,m³,52.5,2100\n...'}
            className="w-full text-xs font-mono bg-infra-darker border border-infra-accent/40 rounded px-3 py-2 text-white resize-none placeholder-gray-600"
          />
          {parseError && <p className="text-xs text-red-400 mt-1">⚠ {parseError}</p>}
        </div>

        {/* Run button */}
        <button type="button" onClick={runVerification} disabled={loading || !rawInput.trim()}
          className="w-full py-2.5 bg-infra-highlight hover:bg-infra-highlight/80 disabled:opacity-50 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition-colors">
          {loading ? 'Verifying…' : 'RUN QUANTITY VERIFICATION'}
        </button>

        {/* Results */}
        {results && (
          <>
            {/* Summary banner */}
            <div className={`p-3 rounded-lg border text-center font-bold text-sm ${
              overallRisk === 'fail'    ? 'bg-red-900/30 border-red-700/50 text-red-400'
              : overallRisk === 'warning' ? 'bg-yellow-900/20 border-yellow-700/40 text-yellow-300'
              : 'bg-emerald-900/20 border-emerald-700/40 text-emerald-400'
            }`}>
              {overallRisk === 'fail' ? `✗ ${fails} LINE${fails!==1?'S':''} EXCEED TOLERANCE — REVIEW BEFORE SIGNING` :
               overallRisk === 'warning' ? `⚠ ${warnings} ITEM${warnings!==1?'S':''} REQUIRE REVIEW` :
               '✓ ALL QUANTITIES WITHIN TOLERANCE'}
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: `FAIL >±${tolerance}%`, val: fails,    color: 'text-red-400' },
                { label: `CHECK >±${Math.round(tolerance/2)}%`, val: warnings, color: 'text-yellow-300' },
                { label: 'PASS',     val: passes,  color: 'text-emerald-400' },
              ].map((k) => (
                <div key={k.label} className="bg-infra-darker rounded p-2 text-center border border-infra-accent/20">
                  <div className={`text-xl font-bold ${k.color}`}>{k.val}</div>
                  <div className="text-[10px] text-gray-500">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Financial summary */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Submitted Total', val: `ZMW ${subTotal.toLocaleString()}`, color: 'text-white' },
                { label: 'Verified Total',  val: `ZMW ${verTotal.toLocaleString()}`, color: 'text-white' },
                { label: subTotal > verTotal ? 'Overpriced by' : 'Underpriced by',
                  val: `ZMW ${Math.abs(subTotal - verTotal).toLocaleString()}`,
                  color: subTotal > verTotal ? 'text-red-400' : 'text-emerald-400' },
              ].map((k) => (
                <div key={k.label} className="bg-infra-darker rounded p-2 text-center border border-infra-accent/20">
                  <div className={`text-sm font-bold ${k.color}`}>{k.val}</div>
                  <div className="text-[10px] text-gray-500">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Line items */}
            <div className="rounded border border-infra-accent/20 overflow-hidden">
              <div className="grid grid-cols-7 gap-0 text-[10px] font-bold text-gray-400 bg-infra-darker px-2 py-1.5 border-b border-infra-accent/20">
                <span>Code</span>
                <span className="col-span-2">Description</span>
                <span className="text-right">Submitted</span>
                <span className="text-right">Verified</span>
                <span className="text-right">Variance</span>
                <span className="text-center">Status</span>
              </div>
              {results.map((r, i) => (
                <div key={i} className={`grid grid-cols-7 gap-0 px-2 py-1.5 border-b border-infra-accent/10 text-xs ${RISK_STYLE[r.risk]}`}>
                  <span className="font-mono text-[10px]">{r.code}</span>
                  <span className="col-span-2 truncate" title={r.description}>{r.description}</span>
                  <span className="text-right font-mono">{r.submitted_qty.toFixed(2)}</span>
                  <span className="text-right font-mono">{r.verified_qty > 0 ? r.verified_qty.toFixed(2) : '—'}</span>
                  <span className={`text-right font-bold font-mono ${r.variance_pct > 30 ? 'text-red-400' : r.variance_pct > 15 ? 'text-yellow-300' : ''}`}>
                    {r.verified_qty > 0 ? `${r.variance_pct > 0 ? '+' : ''}${r.variance_pct}%` : '—'}
                  </span>
                  <span className="text-center text-[10px] font-bold">{RISK_LABEL[r.risk]}</span>
                </div>
              ))}
            </div>

            {/* Blockchain anchor */}
            {anchor && (
              <div className="p-2 bg-slate-800/60 rounded border border-slate-600/40 text-[10px] text-gray-500">
                🔗 {anchorBadge(anchor)}
              </div>
            )}

            {/* Print button */}
            <button type="button" onClick={printReport}
              className="w-full py-2 border border-infra-accent/50 hover:bg-infra-accent/20 text-gray-300 text-xs rounded transition-colors">
              📄 Print / Export Verification Report
            </button>
          </>
        )}
      </div>
    </div>
  );
}

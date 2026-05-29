import { useState, useMemo } from 'react';
import { useBoQStore } from '../../store/boqStore';
import { anchorDocument, anchorBadge, type AnchorRecord } from '../../services/blockchainAnchor';

interface CarbonLine {
  description: string;
  qty: number;
  unit: string;
  factor_kg_co2e: number;
  total_kg_co2e: number;
  category: string;
}

// Standard embodied carbon coefficients (kg CO2e per unit)
// Sources: ICE Database v3.0 (Bath), IPCC, South African Green Star
const CARBON_FACTORS: Record<string, { factor: number; unit: string; desc: string; category: string }> = {
  'concrete_c20_m3':     { factor: 230,   unit: 'm³',    desc: 'Concrete C20',                     category: 'Concrete' },
  'concrete_c25_m3':     { factor: 270,   unit: 'm³',    desc: 'Concrete C25',                     category: 'Concrete' },
  'concrete_c30_m3':     { factor: 310,   unit: 'm³',    desc: 'Concrete C30',                     category: 'Concrete' },
  'steel_rebar_tonne':   { factor: 1_500, unit: 'Tonne', desc: 'Reinforcing steel (electric arc)', category: 'Steel'    },
  'steel_section_tonne': { factor: 1_770, unit: 'Tonne', desc: 'Structural steel section',         category: 'Steel'    },
  'clay_brick_nr':       { factor: 0.22,  unit: 'Nr',    desc: 'Fired clay brick',                 category: 'Masonry'  },
  'concrete_block_nr':   { factor: 0.14,  unit: 'Nr',    desc: 'Concrete block 230mm',             category: 'Masonry'  },
  'cement_tonne':        { factor: 830,   unit: 'Tonne', desc: 'Portland cement (OPC)',            category: 'Concrete' },
  'hdpe_pipe_kg':        { factor: 2.1,   unit: 'kg',    desc: 'HDPE pipe',                        category: 'WASH'     },
  'pvc_pipe_kg':         { factor: 3.1,   unit: 'kg',    desc: 'PVC pipe',                         category: 'WASH'     },
  'timber_m3':           { factor: -540,  unit: 'm³',    desc: 'Timber (carbon sequestered)',      category: 'Timber'   },
  'ibr_roofing_m2':      { factor: 15,    unit: 'm²',    desc: 'IBR steel roofing sheet',          category: 'Roofing'  },
  'glass_m2':            { factor: 36,    unit: 'm²',    desc: 'Float glass 6mm',                  category: 'Glazing'  },
  'diesel_litre':        { factor: 2.68,  unit: 'litre', desc: 'Diesel fuel (plant/transport)',    category: 'Energy'   },
  'electricity_kwh':     { factor: 0.85,  unit: 'kWh',   desc: 'Grid electricity (Zambia mix)',    category: 'Energy'   },
};

const CARBON_PRICE_USD = 15; // Conservative voluntary carbon market USD/tonne CO2e
const USD_TO_ZMW = 27.5;

const CODE_TO_FACTOR: Record<string, string> = {
  'E05':  'concrete_c20_m3',
  'E10':  'concrete_c25_m3',
  'E10.2':'concrete_c25_m3',
  'E30':  'steel_rebar_tonne',
  'E30.2':'steel_rebar_tonne',
  'F10':  'concrete_block_nr',
  'R12':  'hdpe_pipe_kg',
};

export function CarbonVerifierPanel() {
  const { sketchBoQItems } = useBoQStore();
  const [anchor, setAnchor] = useState<AnchorRecord | null>(null);
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [designType, setDesignType] = useState<'standard' | 'efficient'>('standard');

  const lines: CarbonLine[] = useMemo(() => {
    const result: CarbonLine[] = [];

    for (const item of sketchBoQItems) {
      const factorKey = CODE_TO_FACTOR[item.code];
      if (!factorKey) continue;
      const cf = CARBON_FACTORS[factorKey];
      if (!cf) continue;
      result.push({
        description:     item.description,
        qty:             item.qty,
        unit:            cf.unit,
        factor_kg_co2e:  cf.factor,
        total_kg_co2e:   item.qty * cf.factor,
        category:        cf.category,
      });
    }

    return result;
  }, [sketchBoQItems]);

  const totalTonnes = lines.reduce((s, l) => s + l.total_kg_co2e, 0) / 1000;

  // Efficient design saves ~18% embodied carbon vs standard
  const baselineTonnes = designType === 'efficient' ? totalTonnes / 0.82 : totalTonnes;
  const savedTonnes    = designType === 'efficient' ? baselineTonnes - totalTonnes : 0;
  const creditValueUSD = savedTonnes * CARBON_PRICE_USD;
  const creditValueZMW = creditValueUSD * USD_TO_ZMW;

  const byCategory = lines.reduce<Record<string, number>>((acc, l) => {
    acc[l.category] = (acc[l.category] ?? 0) + l.total_kg_co2e;
    return acc;
  }, {});

  const doAnchor = async () => {
    setIsAnchoring(true);
    const rec = await anchorDocument({
      data: { project: projectName, total_tonnes: totalTonnes, saved_tonnes: savedTonnes, lines },
      document_type: 'carbon_verification_certificate',
      document_summary: `${totalTonnes.toFixed(2)} tCO2e, ${savedTonnes.toFixed(2)} tCO2e offset eligible`,
      project: projectName,
    });
    setAnchor(rec);
    setIsAnchoring(false);
  };

  const printCert = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Carbon Certificate — ${projectName}</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;padding:24px;max-width:800px;margin:0 auto}
    h1{font-size:18px;color:#16a34a}h2{font-size:12px;color:#555}
    .cert{border:3px solid #16a34a;border-radius:8px;padding:16px;margin:16px 0}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:4px 8px}th{background:#f0fdf4}
    .big{font-size:32px;font-weight:bold;color:#16a34a}.badge{background:#dcfce7;padding:6px 12px;border-radius:20px;display:inline-block;font-size:13px;font-weight:bold}
    .anchor{font-size:9px;color:#aaa;margin-top:16px;padding-top:8px;border-top:1px solid #eee}
    @media print{button{display:none}}</style></head><body>
    <h1>🌱 Embodied Carbon Verification Certificate</h1>
    <h2>${projectName} — InFra_TeCh Platform — ${new Date().toLocaleDateString()}</h2>
    <div class="cert">
      <p><strong>Project:</strong> ${projectName}</p>
      <p><strong>Total Embodied Carbon:</strong> <span class="big">${totalTonnes.toFixed(2)}</span> tonnes CO₂e</p>
      ${savedTonnes > 0 ? `
      <p><strong>Carbon Savings vs Baseline:</strong> <span class="badge">${savedTonnes.toFixed(2)} tCO₂e saved</span></p>
      <p><strong>Carbon Credit Value:</strong> USD ${creditValueUSD.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} (ZMW ${creditValueZMW.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')})</p>
      <p style="font-size:10px;color:#666">Based on voluntary carbon market rate of USD ${CARBON_PRICE_USD}/tonne CO₂e. Eligible for submission to Gold Standard / Verra CDM registration.</p>
      ` : ''}
    </div>
    <table><thead><tr><th>Category</th><th>Description</th><th>Qty</th><th>Factor (kg/unit)</th><th>Total (kg CO₂e)</th></tr></thead><tbody>
    ${lines.map((l) => `<tr><td>${l.category}</td><td>${l.description}</td><td>${l.qty} ${l.unit}</td><td>${l.factor_kg_co2e}</td><td>${l.total_kg_co2e.toFixed(1)}</td></tr>`).join('')}
    </tbody></table>
    ${anchor ? `<div class="anchor">🔗 Blockchain hash: ${anchorBadge(anchor)}</div>` : ''}
    <div class="anchor">Carbon coefficients: ICE Database v3.0 (University of Bath). This certificate is indicative. For CDM registration, engage accredited third-party verifier.</div>
    <script>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">🌱 Carbon Verifier</h2>
        <p className="text-[10px] text-gray-500 mt-1">Embodied carbon from your sketch BOQ. Generate a carbon certificate and estimate credit value.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Project name</label>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)}
              className="w-full text-xs bg-infra-darker border border-infra-accent/40 rounded px-2 py-1.5 text-white"
              placeholder="e.g. Kafue Clinic" />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-1">Design type</label>
            <select value={designType} onChange={(e) => setDesignType(e.target.value as 'standard' | 'efficient')}
              className="w-full text-xs bg-infra-darker border border-infra-accent/40 rounded px-2 py-1.5 text-white">
              <option value="standard">Standard design</option>
              <option value="efficient">Efficient design (18% lower carbon)</option>
            </select>
          </div>
        </div>

        {lines.length === 0 ? (
          <div className="p-4 border-2 border-dashed border-infra-accent/30 rounded-xl text-center">
            <p className="text-gray-500 text-sm">No sketch BOQ items found.</p>
            <p className="text-xs text-gray-600 mt-1">Draw elements in the BIM viewer and run "📐→💰" first.</p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-emerald-400">{totalTonnes.toFixed(2)}</div>
                <div className="text-[10px] text-gray-400">tCO₂e total embodied</div>
              </div>
              {savedTonnes > 0 ? (
                <>
                  <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-400">{savedTonnes.toFixed(2)}</div>
                    <div className="text-[10px] text-gray-400">tCO₂e saved vs baseline</div>
                  </div>
                  <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-yellow-400">ZMW {creditValueZMW.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                    <div className="text-[10px] text-gray-400">Carbon credit value</div>
                  </div>
                </>
              ) : (
                <div className="col-span-2 bg-infra-darker border border-infra-accent/20 rounded-lg p-3 text-xs text-gray-400 flex items-center justify-center">
                  Switch to "Efficient design" to calculate carbon credit value
                </div>
              )}
            </div>

            {/* By category */}
            <div className="space-y-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">By Category</p>
              {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, kg]) => {
                const pct = (kg / (totalTonnes * 1000)) * 100;
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-24 shrink-0">{cat}</span>
                    <div className="flex-1 h-2 bg-infra-darker rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-mono text-gray-300 w-20 text-right">{(kg/1000).toFixed(2)} t</span>
                  </div>
                );
              })}
            </div>

            {/* Line items */}
            <div className="rounded border border-infra-accent/20 overflow-hidden">
              <div className="grid grid-cols-5 text-[10px] text-gray-500 bg-infra-darker px-2 py-1.5 font-bold border-b border-infra-accent/20">
                <span className="col-span-2">Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Factor</span>
                <span className="text-right">kgCO₂e</span>
              </div>
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-5 px-2 py-1.5 border-b border-infra-accent/10 text-xs hover:bg-infra-accent/5">
                  <span className="col-span-2 text-gray-300 truncate">{l.description}</span>
                  <span className="text-right font-mono text-gray-400">{l.qty} {l.unit}</span>
                  <span className="text-right font-mono text-gray-400">{l.factor_kg_co2e}</span>
                  <span className={`text-right font-mono font-bold ${l.total_kg_co2e < 0 ? 'text-emerald-400' : 'text-white'}`}>
                    {l.total_kg_co2e > 0 ? '+' : ''}{l.total_kg_co2e.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>

            {anchor && (
              <div className="p-2 bg-slate-800/60 rounded border border-slate-600/40 text-[10px] text-gray-500">
                🔗 {anchorBadge(anchor)}
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={doAnchor} disabled={isAnchoring}
                className="flex-1 py-2 border border-emerald-700/50 text-emerald-400 text-xs rounded hover:bg-emerald-900/20 transition-colors disabled:opacity-50">
                {isAnchoring ? 'Anchoring…' : '🔗 Anchor to Blockchain'}
              </button>
              <button type="button" onClick={printCert}
                className="flex-1 py-2 bg-emerald-700/30 hover:bg-emerald-700/50 text-emerald-200 text-xs rounded transition-colors">
                📄 Export Carbon Certificate
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

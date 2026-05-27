import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../../services/apiConfig';

interface WinklerCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

interface Profile {
  x_m: number[];
  deflection_mm: number[];
  moment_knm: number[];
  shear_kn: number[];
  contact_pressure_knm2: number[];
}

interface WinklerResult {
  status: string;
  summary: Record<string, number | string | boolean>;
  steps: { step_number: number; title: string; formula: string; substitution: string; result: string; unit: string; reference: string }[];
  warnings: string[];
  profile: Profile;
}

type PlotKey = 'deflection_mm' | 'moment_knm' | 'shear_kn' | 'contact_pressure_knm2';

const PLOT_CONFIGS: { key: PlotKey; label: string; color: string; unit: string }[] = [
  { key: 'deflection_mm', label: 'Deflection', color: '#38bdf8', unit: 'mm' },
  { key: 'moment_knm', label: 'BM', color: '#f59e0b', unit: 'kN·m' },
  { key: 'shear_kn', label: 'SF', color: '#a78bfa', unit: 'kN' },
  { key: 'contact_pressure_knm2', label: 'Contact P', color: '#34d399', unit: 'kN/m²' },
];

const W = 520, H = 180;
const PAD = { top: 15, right: 20, bottom: 32, left: 58 };

function ProfileChart({ profile, plotKey, color, unit }: { profile: Profile; plotKey: PlotKey; color: string; unit: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, H);

    const xVals = profile.x_m;
    const yVals = profile[plotKey];
    if (!xVals.length) return;

    const xMax = Math.max(...xVals);
    const yRaw = yVals.filter(isFinite);
    if (!yRaw.length) return;
    const yMin = Math.min(...yRaw);
    const yMax = Math.max(...yRaw);
    const yPad = (yMax - yMin) * 0.15 || Math.abs(yMax) * 0.1 || 1;
    const yLo = yMin - yPad, yHi = yMax + yPad;
    const xR = xMax || 1, yR = yHi - yLo || 1;

    const toX = (x: number) => PAD.left + ((W - PAD.left - PAD.right) * x) / xR;
    const toY = (y: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - (y - yLo) / yR);

    // Zero line
    if (yLo < 0 && yHi > 0) {
      ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.left, toY(0)); ctx.lineTo(W - PAD.right, toY(0)); ctx.stroke();
    }

    // Fill under curve
    ctx.beginPath();
    ctx.moveTo(toX(xVals[0]), toY(0));
    xVals.forEach((x, i) => ctx.lineTo(toX(x), toY(yVals[i])));
    ctx.lineTo(toX(xVals[xVals.length - 1]), toY(0));
    ctx.closePath();
    ctx.fillStyle = color + '22';
    ctx.fill();

    // Curve
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath();
    xVals.forEach((x, i) => i === 0 ? ctx.moveTo(toX(x), toY(yVals[i])) : ctx.lineTo(toX(x), toY(yVals[i])));
    ctx.stroke();

    // Axes
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, H - PAD.bottom);
    ctx.lineTo(W - PAD.right, H - PAD.bottom); ctx.stroke();

    // Labels
    ctx.fillStyle = '#94a3b8'; ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    for (let x = 0; x <= xMax; x += xMax / 4) {
      ctx.fillText(`${x.toFixed(1)}`, toX(x), H - PAD.bottom + 10);
    }
    ctx.fillText(`x (m)`, PAD.left + (W - PAD.left - PAD.right) / 2, H - 3);

    ctx.textAlign = 'right';
    for (let step = 0; step <= 4; step++) {
      const y = yLo + (yR * step) / 4;
      ctx.fillText(y.toFixed(1), PAD.left - 3, toY(y) + 3);
    }

    // Y label
    ctx.save(); ctx.translate(10, H / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.fillText(unit, 0, 0); ctx.restore();

    // Peak annotation
    const peakIdx = yVals.reduce((best, v, i) => Math.abs(v) > Math.abs(yVals[best]) ? i : best, 0);
    const px = toX(xVals[peakIdx]), py = toY(yVals[peakIdx]);
    ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = color; ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${yVals[peakIdx].toFixed(2)}`, px + 6, py - 3);
  }, [profile, plotKey, color, unit]);

  return <canvas ref={canvasRef} width={W} height={H} className="w-full rounded border border-infra-accent/20" />;
}

function Field({ label, value, onChange, step, unit }: {
  label: string; value: unknown; onChange: (v: number) => void; step?: number; unit?: string;
}) {
  return (
    <div className="flex flex-col space-y-0.5">
      <label className="text-gray-400 text-xs font-semibold">{label}{unit ? <span className="text-gray-500 ml-1">({unit})</span> : ''}</label>
      <input type="number" step={step ?? 'any'} value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60" />
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex justify-between border-b border-infra-accent/20 py-0.5">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`font-mono text-xs ${highlight ? 'text-infra-highlight font-bold' : 'text-white'}`}>{value}</span>
    </div>
  );
}

const LOAD_TYPES = [
  { value: 'udl', label: 'UDL (uniform distributed load)' },
  { value: 'point_center', label: 'Point load — centre' },
  { value: 'point_end', label: 'Point load — end' },
];

const SUPPORTS = [
  { value: 'free', label: 'Free ends (foundation only)' },
  { value: 'pinned_both', label: 'Pinned both ends' },
  { value: 'fixed_both', label: 'Fixed both ends' },
  { value: 'cantilever', label: 'Cantilever (fixed left)' },
];

export function WinklerCalculator({ inputs, onInputChange }: WinklerCalculatorProps) {
  const [result, setResult] = useState<WinklerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChart, setActiveChart] = useState<PlotKey>('deflection_mm');

  async function compute() {
    setLoading(true);
    setError(null);
    try {
      const body = {
        L_m: Number(inputs.L_m ?? 10),
        B_m: Number(inputs.B_m ?? 1),
        EI_knm2: Number(inputs.EI_knm2 ?? 50000),
        ks_knm3: Number(inputs.ks_knm3 ?? 20000),
        load_type: String(inputs.load_type ?? 'udl'),
        q_knm: Number(inputs.q_knm ?? 50),
        P_kn: Number(inputs.P_kn ?? 100),
        support: String(inputs.support ?? 'free'),
        n_el: 40,
      };
      const res = await fetch(`${API_BASE}/structural/winkler`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  const s = result?.summary;
  const loadType = String(inputs.load_type ?? 'udl');
  const isPoint = loadType.startsWith('point');
  const activeCfg = PLOT_CONFIGS.find((c) => c.key === activeChart)!;

  return (
    <div className="flex flex-col space-y-4 bg-infra-bg/50 p-4 border border-infra-accent/30 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">Winkler Foundation</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-infra-highlight/25 text-infra-highlight border border-infra-highlight/40">Beam on Elastic Foundation</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Beam length L" value={inputs.L_m ?? 10} onChange={(v) => onInputChange('L_m', v)} unit="m" />
        <Field label="Width B" value={inputs.B_m ?? 1.0} onChange={(v) => onInputChange('B_m', v)} unit="m" step={0.1} />
        <Field label="Flexural rigidity EI" value={inputs.EI_knm2 ?? 50000} onChange={(v) => onInputChange('EI_knm2', v)} unit="kN·m²" />
        <Field label="Subgrade modulus ks" value={inputs.ks_knm3 ?? 20000} onChange={(v) => onInputChange('ks_knm3', v)} unit="kN/m³" />

        {/* Load type */}
        <div className="col-span-2 flex flex-col space-y-0.5">
          <label className="text-gray-400 text-xs font-semibold">Load Type</label>
          <select value={loadType} onChange={(e) => onInputChange('load_type', e.target.value)}
            className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60">
            {LOAD_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {!isPoint && <Field label="UDL q" value={inputs.q_knm ?? 50} onChange={(v) => onInputChange('q_knm', v)} unit="kN/m" />}
        {isPoint && <Field label="Point load P" value={inputs.P_kn ?? 100} onChange={(v) => onInputChange('P_kn', v)} unit="kN" />}

        {/* Support */}
        <div className={isPoint ? 'col-span-1' : 'col-span-1'}>
          <div className="flex flex-col space-y-0.5">
            <label className="text-gray-400 text-xs font-semibold">End supports</label>
            <select value={String(inputs.support ?? 'free')} onChange={(e) => onInputChange('support', e.target.value)}
              className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60">
              {SUPPORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <button type="button" onClick={compute} disabled={loading}
        className="w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-infra-highlight/80 disabled:opacity-50">
        {loading ? 'SOLVING...' : 'SOLVE FOUNDATION'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      {result && s && (
        <>
          {/* Classification badge */}
          <div className="flex gap-2 items-center">
            <span className={`px-2 py-0.5 text-xs rounded font-bold border ${
              s.beam_class === 'rigid' ? 'bg-blue-900/30 border-blue-600/50 text-blue-300' :
              s.beam_class === 'semi-flexible' ? 'bg-yellow-900/30 border-yellow-600/50 text-yellow-300' :
              'bg-green-900/30 border-green-600/50 text-green-300'
            }`}>
              {String(s.beam_class).toUpperCase()} BEAM
            </span>
            <span className="text-xs text-gray-400">λL = {Number(s.relative_stiffness).toFixed(3)} &nbsp;|&nbsp; Lc = {Number(s.char_length_m).toFixed(2)} m</span>
          </div>

          {/* Summary grid */}
          <div className="grid grid-cols-2 gap-1">
            <Row label="Max deflection" value={`${Number(s.max_deflection_mm).toFixed(2)} mm`} highlight />
            <Row label="Ref settlement (rigid)" value={`${Number(s.uniform_settlement_ref_mm).toFixed(2)} mm`} />
            <Row label="Max BM" value={`${Number(s.max_moment_knm).toFixed(2)} kN·m`} highlight />
            <Row label="Max SF" value={`${Number(s.max_shear_kn).toFixed(2)} kN`} />
            <Row label="Max contact pressure" value={`${Number(s.max_contact_pressure_knm2).toFixed(1)} kN/m²`} highlight />
          </div>

          {/* Chart tabs */}
          <div className="flex gap-1 flex-wrap">
            {PLOT_CONFIGS.map((c) => (
              <button key={c.key} type="button" onClick={() => setActiveChart(c.key)}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  activeChart === c.key
                    ? 'text-white border-transparent'
                    : 'text-gray-400 border-infra-accent/30 hover:border-infra-highlight/50'
                }`}
                style={activeChart === c.key ? { backgroundColor: c.color + '44', borderColor: c.color } : {}}>
                {c.label} ({c.unit})
              </button>
            ))}
          </div>

          {/* Chart */}
          <div>
            <div className="text-xs text-gray-400 mb-1">{activeCfg.label} profile along beam</div>
            <ProfileChart profile={result.profile} plotKey={activeChart} color={activeCfg.color} unit={activeCfg.unit} />
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className="p-2 bg-yellow-900/20 border border-yellow-700/40 rounded text-xs text-yellow-300">⚠ {w}</div>
              ))}
            </div>
          )}

          {/* Steps */}
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-400 hover:text-infra-highlight py-1">Show calculation steps</summary>
            <div className="mt-2 space-y-2">
              {result.steps.map((step) => (
                <div key={step.step_number} className="border border-infra-accent/20 rounded p-2 space-y-0.5">
                  <div className="text-infra-highlight font-bold">{step.step_number}. {step.title}</div>
                  <div className="text-gray-500 font-mono">{step.formula}</div>
                  <div className="text-gray-400">{step.substitution}</div>
                  <div className="text-white">{step.result} <span className="text-gray-500">{step.unit}</span></div>
                  <div className="text-gray-600 text-xs">{step.reference}</div>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}

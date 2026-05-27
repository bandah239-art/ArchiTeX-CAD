import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../../services/apiConfig';

interface WaterHammerCalculatorProps {
  inputs: Record<string, unknown>;
  onInputChange: (key: string, value: unknown) => void;
}

interface WaterHammerResult {
  status: string;
  summary: Record<string, number | string | boolean>;
  steps: { step_number: number; title: string; formula: string; result: string; reference: string }[];
  warnings: string[];
  pressure_envelope: { x_m: number[]; H_max_m: number[]; H_min_m: number[] };
}

const PIPE_MATERIALS = [
  { value: 'steel', label: 'Steel (E=200 GPa)', E: 200 },
  { value: 'ductile_iron', label: 'Ductile Iron (E=170 GPa)', E: 170 },
  { value: 'pvc', label: 'PVC (E=3 GPa)', E: 3 },
  { value: 'hdpe', label: 'HDPE (E=0.8 GPa)', E: 0.8 },
  { value: 'concrete', label: 'Prestressed Concrete (E=40 GPa)', E: 40 },
];

function Field({ label, value, onChange, step, unit }: {
  label: string; value: unknown; onChange: (v: number) => void; step?: number; unit?: string;
}) {
  return (
    <div className="flex flex-col space-y-0.5">
      <label className="text-gray-400 text-xs font-semibold">{label}{unit ? <span className="text-gray-500 ml-1">({unit})</span> : ''}</label>
      <input
        type="number" step={step ?? 'any'}
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60"
      />
    </div>
  );
}

function Row({ label, value, highlight, danger }: { label: string; value: string | number; highlight?: boolean; danger?: boolean }) {
  return (
    <div className="flex justify-between border-b border-infra-accent/20 py-0.5">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`font-mono text-xs ${danger ? 'text-red-400 font-bold' : highlight ? 'text-infra-highlight font-bold' : 'text-white'}`}>{value}</span>
    </div>
  );
}

const W = 520, H = 200, PAD = { top: 15, right: 20, bottom: 35, left: 55 };

function EnvelopeChart({ data, H_static }: { data: WaterHammerResult['pressure_envelope']; H_static: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const xVals = data.x_m;
    const hMax = data.H_max_m;
    const hMin = data.H_min_m;
    const xMax = Math.max(...xVals);
    const yMin = Math.min(...hMin, 0) - 10;
    const yMax = Math.max(...hMax) + 10;
    const xRange = xMax || 1;
    const yRange = yMax - yMin || 1;

    const toX = (x: number) => PAD.left + ((W - PAD.left - PAD.right) * x) / xRange;
    const toY = (y: number) => PAD.top + (H - PAD.top - PAD.bottom) * (1 - (y - yMin) / yRange);

    // Grid
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1;
    for (let x = 0; x <= xMax; x += xMax / 5) {
      ctx.beginPath(); ctx.moveTo(toX(x), PAD.top); ctx.lineTo(toX(x), H - PAD.bottom); ctx.stroke();
    }

    // Static head line
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(toX(0), toY(H_static)); ctx.lineTo(toX(xMax), toY(H_static)); ctx.stroke();
    ctx.setLineDash([]);

    // H_max (red)
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
    ctx.beginPath();
    xVals.forEach((x, i) => i === 0 ? ctx.moveTo(toX(x), toY(hMax[i])) : ctx.lineTo(toX(x), toY(hMax[i])));
    ctx.stroke();

    // H_min (blue)
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
    ctx.beginPath();
    xVals.forEach((x, i) => i === 0 ? ctx.moveTo(toX(x), toY(hMin[i])) : ctx.lineTo(toX(x), toY(hMin[i])));
    ctx.stroke();

    // Zero line (if visible)
    if (yMin < 0 && yMax > 0) {
      ctx.strokeStyle = '#f43f5e88'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(PAD.left, toY(0)); ctx.lineTo(W - PAD.right, toY(0)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f43f5e'; ctx.font = '9px monospace'; ctx.fillText('0 m', PAD.left + 2, toY(0) - 3);
    }

    // Axes
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, H - PAD.bottom);
    ctx.lineTo(W - PAD.right, H - PAD.bottom); ctx.stroke();

    // Labels
    ctx.fillStyle = '#94a3b8'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    for (let x = 0; x <= xMax; x += xMax / 4) {
      ctx.fillText(`${x.toFixed(0)}m`, toX(x), H - PAD.bottom + 12);
    }
    ctx.textAlign = 'right';
    for (let step = 0; step <= 4; step++) {
      const y = yMin + (yRange * step) / 4;
      ctx.fillText(`${y.toFixed(0)}`, PAD.left - 3, toY(y) + 3);
    }
    ctx.save(); ctx.translate(12, H / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.fillText('Head (m)', 0, 0); ctx.restore();

    // Legend
    [['#ef4444', 'H_max'], ['#38bdf8', 'H_min'], ['#475569', 'H_static']].forEach(([color, label], i) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash(i === 2 ? [4, 3] : []);
      ctx.beginPath(); ctx.moveTo(PAD.left + 6 + i * 85, PAD.top + 10); ctx.lineTo(PAD.left + 24 + i * 85, PAD.top + 10); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left'; ctx.font = '9px sans-serif';
      ctx.fillText(label, PAD.left + 28 + i * 85, PAD.top + 14);
    });
  }, [data, H_static]);

  return (
    <canvas ref={canvasRef} width={W} height={H}
      className="w-full rounded border border-infra-accent/30" />
  );
}

export function WaterHammerCalculator({ inputs, onInputChange }: WaterHammerCalculatorProps) {
  const [result, setResult] = useState<WaterHammerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compute() {
    setLoading(true);
    setError(null);
    try {
      const mat = PIPE_MATERIALS.find((m) => m.value === inputs.pipe_material) ?? PIPE_MATERIALS[0];
      const body = {
        D_mm: Number(inputs.D_mm ?? 200),
        t_mm: Number(inputs.t_mm ?? 6),
        L_m: Number(inputs.L_m ?? 500),
        V0_ms: Number(inputs.V0_ms ?? 1.5),
        Tc_s: Number(inputs.Tc_s ?? 0),
        H_static_m: Number(inputs.H_static_m ?? 50),
        E_pipe_gpa: Number(inputs.E_pipe_gpa ?? mat.E),
        pipe_material: String(inputs.pipe_material ?? 'steel'),
        safety_factor: Number(inputs.safety_factor ?? 1.3),
      };
      const res = await fetch(`${API_BASE}/wash/water-hammer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }

  const s = result?.summary;
  const colSep = s?.column_separation === true;

  return (
    <div className="flex flex-col space-y-4 bg-infra-bg/50 p-4 border border-infra-accent/30 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">Water Hammer</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-infra-highlight/25 text-infra-highlight border border-infra-highlight/40">Joukowsky / FEM</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Material selector */}
        <div className="col-span-2 flex flex-col space-y-0.5">
          <label className="text-gray-400 text-xs font-semibold">Pipe Material</label>
          <select
            value={String(inputs.pipe_material ?? 'steel')}
            onChange={(e) => {
              const mat = PIPE_MATERIALS.find((m) => m.value === e.target.value)!;
              onInputChange('pipe_material', e.target.value);
              onInputChange('E_pipe_gpa', mat.E);
            }}
            className="w-full px-2 py-1.5 bg-infra-darker border border-infra-accent/40 rounded text-white text-xs focus:outline-none focus:border-infra-highlight/60"
          >
            {PIPE_MATERIALS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <Field label="Diameter D" value={inputs.D_mm ?? 200} onChange={(v) => onInputChange('D_mm', v)} unit="mm" />
        <Field label="Wall thickness t" value={inputs.t_mm ?? 6} onChange={(v) => onInputChange('t_mm', v)} unit="mm" />
        <Field label="Pipe length L" value={inputs.L_m ?? 500} onChange={(v) => onInputChange('L_m', v)} unit="m" />
        <Field label="Flow velocity V₀" value={inputs.V0_ms ?? 1.5} onChange={(v) => onInputChange('V0_ms', v)} unit="m/s" />
        <Field label="Valve close time Tc" value={inputs.Tc_s ?? 0} onChange={(v) => onInputChange('Tc_s', v)} unit="s (0=sudden)" step={0.1} />
        <Field label="Static head H₀" value={inputs.H_static_m ?? 50} onChange={(v) => onInputChange('H_static_m', v)} unit="m" />
        <Field label="Elastic modulus E" value={inputs.E_pipe_gpa ?? 200} onChange={(v) => onInputChange('E_pipe_gpa', v)} unit="GPa" />
        <Field label="Safety factor" value={inputs.safety_factor ?? 1.3} onChange={(v) => onInputChange('safety_factor', v)} step={0.05} />
      </div>

      <button type="button" onClick={compute} disabled={loading}
        className="w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded uppercase tracking-wider hover:bg-infra-highlight/80 disabled:opacity-50">
        {loading ? 'COMPUTING...' : 'ANALYSE SURGE'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      {result && s && (
        <>
          {/* Column separation alert */}
          {colSep && (
            <div className="p-2 bg-red-900/40 border border-red-500/60 rounded text-xs text-red-300 font-bold">
              ⚠ COLUMN SEPARATION — H_min = {Number(s.H_min_m).toFixed(1)} m &lt; 0 m. Risk of pipe collapse or vapour cavity.
            </div>
          )}

          <div className="grid grid-cols-2 gap-1">
            <Row label="Wave speed c" value={`${Number(s.wave_speed_ms).toFixed(0)} m/s`} />
            <Row label="Critical Tc" value={`${Number(s.Tc_critical_s).toFixed(3)} s`} />
            <Row label="Closure type" value={String(s.closure_type)} />
            <Row label="ΔP (instant)" value={`${Number(s.dP_instant_kpa).toFixed(0)} kPa`} />
            <Row label="ΔH (instant)" value={`${Number(s.dH_instant_m).toFixed(1)} m`} />
            <Row label="ΔH (design)" value={`${Number(s.dH_design_m).toFixed(1)} m`} highlight />
            <Row label="H_max (valve)" value={`${Number(s.H_max_m).toFixed(1)} m`} highlight />
            <Row label="H_min (valve)" value={`${Number(s.H_min_m).toFixed(1)} m`} danger={colSep} />
            <Row label="Design pressure" value={`${Number(s.P_design_kpa).toFixed(0)} kPa`} />
            <Row label="PN class" value={`PN${s.PN_class_bar} bar`} highlight />
          </div>

          {/* Pressure envelope chart */}
          <div className="mt-1">
            <div className="text-xs text-gray-400 mb-1">Pressure Envelope Along Pipe</div>
            <EnvelopeChart data={result.pressure_envelope} H_static={Number(s.H_static_m ?? inputs.H_static_m ?? 50)} />
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
                  <div className="text-gray-500 font-mono text-xs">{step.formula}</div>
                  <div className="text-white text-xs">{step.result}</div>
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

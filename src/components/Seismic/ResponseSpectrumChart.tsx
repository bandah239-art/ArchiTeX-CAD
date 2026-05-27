import { useEffect, useRef } from 'react';

interface SpectrumCurve {
  periods: number[];
  Se: number[];
  Sd: number[];
  Sve: number[];
}

interface ModalResult {
  mode: number;
  period_s: number;
  freq_hz: number;
  Se_ms2: number;
  Sd_ms2: number;
  modal_base_shear_x_kn: number;
  mass_participation_x_pct: number;
}

interface ResponseSpectrumChartProps {
  curve: SpectrumCurve;
  modalResults?: ModalResult[];
  selectedMode?: number;
}

const W = 540;
const H = 280;
const PAD = { top: 20, right: 20, bottom: 40, left: 52 };

function toCanvasX(T: number, Tmax: number) {
  return PAD.left + ((W - PAD.left - PAD.right) * T) / Tmax;
}
function toCanvasY(a: number, amax: number) {
  return PAD.top + (H - PAD.top - PAD.bottom) * (1 - a / amax);
}

export function ResponseSpectrumChart({ curve, modalResults, selectedMode }: ResponseSpectrumChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const Tmax = 4.0;
    const amax = Math.max(...curve.Se, ...curve.Sd, 0.01) * 1.1;

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let t = 0; t <= Tmax; t += 0.5) {
      const cx = toCanvasX(t, Tmax);
      ctx.beginPath();
      ctx.moveTo(cx, PAD.top);
      ctx.lineTo(cx, H - PAD.bottom);
      ctx.stroke();
    }
    for (let a = 0; a <= amax; a += amax / 5) {
      const cy = toCanvasY(a, amax);
      ctx.beginPath();
      ctx.moveTo(PAD.left, cy);
      ctx.lineTo(W - PAD.right, cy);
      ctx.stroke();
    }

    // Se curve (elastic)
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < curve.periods.length; i++) {
      const cx = toCanvasX(curve.periods[i], Tmax);
      const cy = toCanvasY(curve.Se[i], amax);
      i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Sd curve (design)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    for (let i = 0; i < curve.periods.length; i++) {
      const cx = toCanvasX(curve.periods[i], Tmax);
      const cy = toCanvasY(curve.Sd[i], amax);
      i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Sve curve (vertical)
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    for (let i = 0; i < curve.periods.length; i++) {
      const cx = toCanvasX(curve.periods[i], Tmax);
      const cy = toCanvasY(curve.Sve[i], amax);
      i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Modal period markers
    if (modalResults) {
      for (const m of modalResults) {
        if (m.period_s > Tmax) continue;
        const cx = toCanvasX(m.period_s, Tmax);
        const cy = toCanvasY(m.Sd_ms2, amax);
        const isSelected = m.mode - 1 === (selectedMode ?? 0);

        ctx.beginPath();
        ctx.arc(cx, cy, isSelected ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#f43f5e' : '#fb7185';
        ctx.fill();

        // Vertical drop line
        ctx.strokeStyle = '#f43f5e66';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, H - PAD.bottom);
        ctx.stroke();

        // Label
        ctx.fillStyle = '#f9a8d4';
        ctx.font = '10px monospace';
        ctx.fillText(`M${m.mode}`, cx + 4, cy - 6);
      }
    }

    // Axes
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top);
    ctx.lineTo(PAD.left, H - PAD.bottom);
    ctx.lineTo(W - PAD.right, H - PAD.bottom);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    for (let t = 0; t <= Tmax; t += 1.0) {
      const cx = toCanvasX(t, Tmax);
      ctx.fillText(`${t}`, cx, H - PAD.bottom + 14);
    }
    ctx.fillText('Period T (s)', PAD.left + (W - PAD.left - PAD.right) / 2, H - 4);

    ctx.textAlign = 'right';
    for (let step = 0; step <= 5; step++) {
      const a = (step / 5) * amax;
      const cy = toCanvasY(a, amax);
      ctx.fillText(a.toFixed(2), PAD.left - 4, cy + 4);
    }

    // Y-axis title
    ctx.save();
    ctx.translate(12, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Sa (m/s²)', 0, 0);
    ctx.restore();

    // Legend
    const legends = [
      { color: '#60a5fa', dash: false, label: 'Se (elastic)' },
      { color: '#f59e0b', dash: true, label: 'Sd (design)' },
      { color: '#a78bfa', dash: true, label: 'Sve (vertical)' },
    ];
    let lx = PAD.left + 6;
    for (const leg of legends) {
      ctx.strokeStyle = leg.color;
      ctx.lineWidth = 1.5;
      if (leg.dash) ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(lx, PAD.top + 10);
      ctx.lineTo(lx + 18, PAD.top + 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.font = '9px sans-serif';
      ctx.fillText(leg.label, lx + 22, PAD.top + 14);
      lx += 90;
    }
  }, [curve, modalResults, selectedMode]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="w-full rounded border border-infra-accent/30"
    />
  );
}

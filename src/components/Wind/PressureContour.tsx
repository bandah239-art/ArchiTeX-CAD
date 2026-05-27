import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../services/apiConfig';

const W = 520, H = 320;

interface CFDData {
  panel_midpoints_x: number[];
  panel_midpoints_y: number[];
  panel_cp: number[];
  cp_max: number;
  cp_min: number;
  cd: number;
  cl: number;
  grid_x: number[];
  grid_y: number[];
  grid_vx: number[][];
  grid_vy: number[][];
  grid_cp: (number | null)[][];
  polygon_x: number[];
  polygon_y: number[];
  wind_speed_ms: number;
  wind_angle_deg: number;
  status: string;
}

interface Props {
  polygon_x: number[];
  polygon_y: number[];
  wind_speed_ms: number;
  wind_angle_deg: number;
}

function cpColor(cp: number, cp_min: number, cp_max: number): string {
  const t = (cp - cp_min) / Math.max(cp_max - cp_min, 0.01);
  // Blue → white → red
  if (t < 0.5) {
    const f = t * 2;
    const r = Math.round(0 + f * 255);
    const g = Math.round(0 + f * 255);
    const b = 255;
    return `rgb(${r},${g},${b})`;
  } else {
    const f = (t - 0.5) * 2;
    const r = 255;
    const g = Math.round(255 - f * 255);
    const b = Math.round(255 - f * 255);
    return `rgb(${r},${g},${b})`;
  }
}

export function PressureContour({ polygon_x, polygon_y, wind_speed_ms, wind_angle_deg }: Props) {
  const [data, setData] = useState<CFDData | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!polygon_x.length) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/wind/cfd-panel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polygon_x, polygon_y, wind_speed_ms, wind_angle_deg }),
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    return () => ac.abort();
  }, [polygon_x, polygon_y, wind_speed_ms, wind_angle_deg]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.status !== 'ok') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, W, H);

    const PAD = 30;
    const xs = data.grid_x, ys = data.grid_y;
    const allX = [...xs, ...data.polygon_x];
    const allY = [...ys, ...data.polygon_y];
    const x_min = Math.min(...allX), x_max = Math.max(...allX);
    const y_min = Math.min(...allY), y_max = Math.max(...allY);

    const scaleX = (W - 2 * PAD) / (x_max - x_min);
    const scaleY = (H - 2 * PAD) / (y_max - y_min);
    const sc = Math.min(scaleX, scaleY);
    const ox = PAD + ((W - 2 * PAD) - (x_max - x_min) * sc) / 2;
    const oy = PAD + ((H - 2 * PAD) - (y_max - y_min) * sc) / 2;

    const tx = (x: number) => ox + (x - x_min) * sc;
    const ty = (y: number) => H - oy - (y - y_min) * sc;

    const nx = xs.length, ny = ys.length;
    const cellW = Math.max(1, (nx > 1 ? Math.abs(tx(xs[1]) - tx(xs[0])) : 1));
    const cellH = Math.max(1, (ny > 1 ? Math.abs(ty(ys[0]) - ty(ys[1])) : 1));

    // Draw Cp grid
    for (let iy = 0; iy < data.grid_cp.length; iy++) {
      for (let ix = 0; ix < data.grid_cp[iy].length; ix++) {
        const cp = data.grid_cp[iy][ix];
        if (cp === null || isNaN(cp as unknown as number)) continue;
        ctx.fillStyle = cpColor(cp, data.cp_min - 0.5, data.cp_max + 0.5);
        ctx.fillRect(tx(xs[ix]) - cellW / 2, ty(ys[iy]) - cellH / 2, cellW + 1, cellH + 1);
      }
    }

    // Streamlines (velocity vector arrows)
    const arrowStep = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.8;
    for (let iy = 1; iy < data.grid_cp.length - 1; iy += arrowStep) {
      for (let ix = 1; ix < data.grid_cp[iy].length - 1; ix += arrowStep) {
        const cp = data.grid_cp[iy][ix];
        if (cp === null || isNaN(cp as unknown as number)) continue;
        const vx = data.grid_vx[iy][ix];
        const vy = data.grid_vy[iy][ix];
        const vmag = Math.sqrt(vx * vx + vy * vy);
        if (vmag < 0.1) continue;
        const ax = tx(xs[ix]), ay = ty(ys[iy]);
        const arrowLen = cellW * arrowStep * 0.6;
        const dx = (vx / vmag) * arrowLen;
        const dy = (-vy / vmag) * arrowLen;
        ctx.beginPath();
        ctx.moveTo(ax - dx / 2, ay - dy / 2);
        ctx.lineTo(ax + dx / 2, ay + dy / 2);
        ctx.stroke();
      }
    }

    // Building polygon
    ctx.beginPath();
    data.polygon_x.forEach((x, i) => {
      const px = tx(x), py = ty(data.polygon_y[i]);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(55,65,81,0.95)';
    ctx.fill();
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Panel Cp coloring on building surface
    data.panel_midpoints_x.forEach((mx, i) => {
      const my = data.panel_midpoints_y[i];
      const cp = data.panel_cp[i];
      ctx.beginPath();
      ctx.arc(tx(mx), ty(my), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = cpColor(cp, data.cp_min, data.cp_max);
      ctx.fill();
    });

    // Wind arrow indicator
    const arrowX = PAD / 2 + 8, arrowY = H / 2;
    const arrowAngle = (wind_angle_deg * Math.PI) / 180;
    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(arrowAngle);
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-15, 0); ctx.lineTo(15, 0);
    ctx.moveTo(10, -5); ctx.lineTo(15, 0); ctx.lineTo(10, 5);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#60a5fa';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`U=${wind_speed_ms}m/s`, arrowX, arrowY + 18);

    // Color scale bar (right side)
    const barX = W - 14, barY = H / 4, barH = H / 2;
    for (let i = 0; i < barH; i++) {
      const t = 1 - i / barH;
      const cp = data.cp_min + t * (data.cp_max - data.cp_min);
      ctx.fillStyle = cpColor(cp, data.cp_min, data.cp_max);
      ctx.fillRect(barX, barY + i, 8, 2);
    }
    ctx.fillStyle = '#9ca3af';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${data.cp_max.toFixed(1)}`, barX - 2, barY - 2);
    ctx.fillText('Cp', barX, barY + barH / 2);
    ctx.fillText(`${data.cp_min.toFixed(1)}`, barX - 2, barY + barH + 10);
  }, [data, wind_speed_ms, wind_angle_deg]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Running panel-method CFD…</div>;

  return (
    <div className="space-y-2">
      <canvas ref={canvasRef} width={W} height={H} className="w-full rounded" style={{ background: '#111827' }} />
      {data && data.status === 'ok' && (
        <div className="grid grid-cols-4 gap-2 text-xs">
          <CpCard label="Cp max" value={data.cp_max.toFixed(3)} color="red" />
          <CpCard label="Cp min" value={data.cp_min.toFixed(3)} color="blue" />
          <CpCard label="Cd" value={data.cd.toFixed(4)} color="orange" />
          <CpCard label="Cl" value={data.cl.toFixed(4)} color="green" />
        </div>
      )}
    </div>
  );
}

function CpCard({ label, value, color }: { label: string; value: string; color: string }) {
  const cols: Record<string, string> = {
    red: 'text-red-400', blue: 'text-blue-400', orange: 'text-orange-400', green: 'text-green-400'
  };
  return (
    <div className="rounded p-2 text-center bg-gray-800/60">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className={`font-bold text-sm ${cols[color]}`}>{value}</div>
    </div>
  );
}

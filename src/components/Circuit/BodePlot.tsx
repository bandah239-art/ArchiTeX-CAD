import { API_BASE } from '../../services/apiConfig';
import { useState, useEffect, useRef } from 'react';

const W = 520, H = 200;
const PAD = { top: 14, right: 24, bottom: 36, left: 52 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

interface BodeData {
  frequencies_hz: number[];
  gain_db: number[];
  phase_deg: number[];
  status: string;
}

interface Props {
  components: object[];
  freq_start: number;
  freq_stop: number;
  n_pts: number;
  input_node: string;
  output_node: string;
}

export function BodePlot({ components, freq_start, freq_stop, n_pts, input_node, output_node }: Props) {
  const [data, setData] = useState<BodeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!components.length) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    fetch(`${API_BASE}/circuit/ac-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ components, freq_start, freq_stop, n_pts, input_node, output_node }),
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    return () => ac.abort();
  }, [components, freq_start, freq_stop, n_pts, input_node, output_node]);

  if (loading) return <div className="text-xs text-gray-400 py-4 text-center">Running AC sweep…</div>;
  if (!data || data.status !== 'ok') return null;

  const freqs = data.frequencies_hz;
  const gains = data.gain_db;
  const phases = data.phase_deg;
  const validGains = gains.filter(isFinite);
  const g_min = Math.min(...validGains) - 3;
  const g_max = Math.max(...validGains) + 3;

  const sx = (f: number) => PAD.left + (Math.log10(f) - Math.log10(freqs[0])) / (Math.log10(freqs[freqs.length - 1]) - Math.log10(freqs[0])) * CW;
  const sg = (g: number) => PAD.top + CH - ((g - g_min) / (g_max - g_min)) * CH;

  const gainPoly = freqs.map((f, i) => isFinite(gains[i]) ? `${sx(f)},${sg(gains[i])}` : '').filter(Boolean).join(' ');
  const hov = hoverIdx !== null ? { f: freqs[hoverIdx], g: gains[hoverIdx], p: phases[hoverIdx] } : null;

  return (
    <div className="space-y-1">
      <svg
        width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded bg-gray-900/40"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width * W;
          const idx = Math.round(((px - PAD.left) / CW) * (freqs.length - 1));
          setHoverIdx(Math.max(0, Math.min(freqs.length - 1, idx)));
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* -3 dB line */}
        {isFinite(g_max) && (
          <line x1={PAD.left} y1={sg(g_max - 3)} x2={W - PAD.right} y2={sg(g_max - 3)}
            stroke="#ef4444" strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
        )}
        <polyline points={gainPoly} fill="none" stroke="#a78bfa" strokeWidth={2} />
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + CH} stroke="#374151" />
        <line x1={PAD.left} y1={PAD.top + CH} x2={PAD.left + CW} y2={PAD.top + CH} stroke="#374151" />
        {[g_min + 3, (g_min + g_max) / 2, g_max - 3].map((g, i) => (
          <text key={i} x={PAD.left - 4} y={sg(g) + 4} fontSize={9} fill="#9ca3af" textAnchor="end">{Math.round(g)}</text>
        ))}
        {[1, 3, 5].map((exp) => {
          const f = Math.pow(10, exp);
          if (f < freqs[0] || f > freqs[freqs.length - 1]) return null;
          return (
            <text key={exp} x={sx(f)} y={PAD.top + CH + 14} fontSize={9} fill="#9ca3af" textAnchor="middle">
              {exp < 4 ? `${f}` : `${f / 1000}k`}
            </text>
          );
        })}
        <text x={PAD.left + CW / 2} y={H - 2} fontSize={9} fill="#6b7280" textAnchor="middle">Frequency (Hz)</text>
        <text x={12} y={PAD.top + CH / 2} fontSize={9} fill="#6b7280" textAnchor="middle" transform={`rotate(-90,12,${PAD.top + CH / 2})`}>Gain (dB)</text>
        {hov && isFinite(hov.g) && (
          <>
            <line x1={sx(hov.f)} y1={PAD.top} x2={sx(hov.f)} y2={PAD.top + CH} stroke="#a78bfa" strokeWidth={1} strokeDasharray="3,2" opacity={0.5} />
            <circle cx={sx(hov.f)} cy={sg(hov.g)} r={3} fill="#a78bfa" />
            <rect x={sx(hov.f) + 4} y={sg(hov.g) - 30} width={128} height={30} rx={3} fill="#111827" opacity={0.9} />
            <text x={sx(hov.f) + 8} y={sg(hov.g) - 16} fontSize={9} fill="#a78bfa">
              {hov.f >= 1000 ? `${(hov.f / 1000).toFixed(1)} kHz` : `${hov.f.toFixed(1)} Hz`}
            </text>
            <text x={sx(hov.f) + 8} y={sg(hov.g) - 4} fontSize={9} fill="#a78bfa">
              {hov.g.toFixed(2)} dB  {hov.p.toFixed(1)}°
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

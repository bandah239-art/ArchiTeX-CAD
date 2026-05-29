import { useState } from 'react';
import { API_BASE } from '../../../services/apiConfig';

interface SiteResult {
  status: string;
  region: { closest_city: string; province: string; altitude_m: number; altitude_note: string };
  wind: { zone_speed_ms: number; basic_pressure_kpa: number; design_code: string };
  seismic: { pga_g: number; design_ground_type: string; narrative: string };
  hydrology: { fitted_city: string; idf_intensity_15min_10yr_mm_hr: number };
  soil_prior: { soil_type: string; expansion_risk: string; risk_color: string };
}

const CITIES = [
  { name: 'Lusaka',      lat: -15.4167, lon: 28.2833 },
  { name: 'Ndola',       lat: -12.9667, lon: 28.6333 },
  { name: 'Livingstone', lat: -17.85,   lon: 25.85   },
  { name: 'Chipata',     lat: -13.6333, lon: 32.65   },
];

const RISK_COLORS: Record<string, string> = {
  HIGH:     'text-red-300 bg-red-900/30 border-red-700/50',
  MODERATE: 'text-yellow-300 bg-yellow-900/30 border-yellow-700/50',
  LOW:      'text-green-300 bg-green-900/30 border-green-700/50',
};

function Row({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="flex justify-between border-b border-infra-accent/20 py-0.5">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className="text-white text-xs font-mono">{value}{unit ? ` ${unit}` : ''}</span>
    </div>
  );
}

export function ZambiaSiteCalculator() {
  const [lat, setLat] = useState(-15.4167);
  const [lon, setLon] = useState(28.2833);
  const [result, setResult] = useState<SiteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compute() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/site/zambia-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude: lat, longitude: lon }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col space-y-4 bg-infra-bg/50 p-4 border border-infra-accent/30 rounded-lg">
      <div className="flex justify-between items-center">
        <h3 className="text-infra-highlight font-bold uppercase text-sm tracking-wider">Zambia Site Data</h3>
        <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">🇿🇲 Zambia</span>
      </div>

      {/* Quick city buttons */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Quick Select City</label>
        <div className="grid grid-cols-2 gap-1">
          {CITIES.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => { setLat(c.lat); setLon(c.lon); }}
              className={`py-1 text-xs rounded border transition-colors ${
                Math.abs(lat - c.lat) < 0.1
                  ? 'border-infra-highlight bg-infra-highlight/20 text-infra-highlight'
                  : 'border-infra-accent/30 text-gray-400 hover:text-gray-200 hover:border-infra-accent/60'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Manual coordinates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Latitude (°S negative)</label>
          <input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(Number(e.target.value))}
            className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Longitude (°E)</label>
          <input
            type="number"
            step="any"
            value={lon}
            onChange={(e) => setLon(Number(e.target.value))}
            className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white focus:outline-none focus:border-infra-highlight/60"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={compute}
        disabled={loading}
        className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded uppercase tracking-wider disabled:opacity-50"
      >
        {loading ? 'FETCHING SITE DATA...' : 'GET ZAMBIA SITE DATA'}
      </button>

      {error && <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{error}</div>}

      {result && (
        <div className="space-y-3">
          {/* Region header */}
          <div className="p-2 bg-infra-darker/80 rounded border border-infra-accent/30 text-center">
            <span className="text-infra-highlight font-bold text-sm">{result.region.closest_city}</span>
            <span className="text-gray-400 text-xs ml-2">{result.region.province} Province · {result.region.altitude_m}m asl</span>
          </div>

          {/* Wind */}
          <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
            <h4 className="text-xs font-bold text-white mb-2">Wind — {result.wind.design_code}</h4>
            <Row label="Basic wind speed" value={result.wind.zone_speed_ms} unit="m/s" />
            <Row label="Basic wind pressure" value={result.wind.basic_pressure_kpa} unit="kPa" />
          </div>

          {/* Seismic */}
          <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
            <h4 className="text-xs font-bold text-white mb-2">Seismic</h4>
            <Row label="PGA" value={`${result.seismic.pga_g}g`} />
            <Row label="Ground type (EC8)" value={result.seismic.design_ground_type} />
            <p className="text-[10px] text-gray-500 mt-1 italic">{result.seismic.narrative}</p>
          </div>

          {/* Hydrology */}
          <div className="p-3 bg-infra-darker/60 rounded border border-infra-accent/20">
            <h4 className="text-xs font-bold text-white mb-2">Hydrology</h4>
            <Row label="IDF intensity — 15 min, 10-yr" value={result.hydrology.idf_intensity_15min_10yr_mm_hr} unit="mm/hr" />
            <p className="text-[10px] text-gray-500 mt-1">Fitted for {result.hydrology.fitted_city}. Use rational method: Q = CiA/360</p>
          </div>

          {/* Soil */}
          <div className={`p-3 rounded border ${RISK_COLORS[result.soil_prior.expansion_risk] ?? 'text-gray-400 bg-infra-darker/60 border-infra-accent/20'}`}>
            <h4 className="text-xs font-bold mb-1">Soil Prior — Expansion Risk: {result.soil_prior.expansion_risk}</h4>
            <p className="text-xs">{result.soil_prior.soil_type}</p>
            {result.soil_prior.expansion_risk !== 'LOW' && (
              <p className="text-[10px] mt-1 italic">Black cotton soil likely. Run Black Cotton Soil calculator for foundation treatment.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

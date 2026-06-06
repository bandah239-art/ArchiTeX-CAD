import { useEffect } from 'react';
import { useGeoStore } from '../../store/geoStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { ZAMBIA_PROVINCES } from '../../constants/zambiaProvinces';

interface ZambiaSitePanelProps {
  onApplySiteData?: () => void;
}

export function ZambiaSitePanel({ onApplySiteData }: ZambiaSitePanelProps) {
  const geo = useGeoStore();
  const openPanel = useWorkspaceStore((s) => s.openPanel);

  useEffect(() => {
    geo.setCountryCode('ZM');
    if (!geo.analysis) {
      geo.locateAnalyseAndBudget();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const zm = (geo.analysis as Record<string, unknown> | null)?.zambia as Record<string, unknown> | undefined;
  const params = geo.analysis?.design_parameters;
  const exec = geo.analysis?.executive_summary;
  const bcs = zm?.black_cotton as Record<string, unknown> | undefined;
  const risks = (zm?.risk_register as Array<Record<string, string>> | undefined) ?? [];

  const handleProvinceSelect = (slug: string) => {
    const prov = ZAMBIA_PROVINCES.find((p) => p.slug === slug);
    if (prov) geo.setLocation(prov.lat, prov.lon);
  };

  const handleApply = () => {
    geo.pushToCalculators();
    openPanel('calculator');
    onApplySiteData?.();
  };

  const selectedSlug =
    ZAMBIA_PROVINCES.find((p) => p.name === String((params as Record<string, unknown> | undefined)?.province ?? ''))?.slug ??
    'lusaka';

  const busy = geo.isAnalysing || geo.isBudgeting;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4 text-white">
      <div className="flex justify-between items-center pb-2 border-b border-infra-accent/20">
        <div>
          <h3 className="text-sm font-bold text-infra-highlight uppercase tracking-wider">Zambia Site Intelligence</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">10-province auto-detect · EC1/EC7/EC8 calibrated</p>
        </div>
        <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded font-mono">ZABS</span>
      </div>

      <div>
        <label className="block text-[10px] text-gray-400 uppercase font-semibold mb-1">Province</label>
        <select
          value={selectedSlug}
          onChange={(e) => handleProvinceSelect(e.target.value)}
          disabled={busy}
          className="w-full bg-infra-darker border border-infra-accent/40 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-infra-highlight"
        >
          {ZAMBIA_PROVINCES.map((p) => (
            <option key={p.slug} value={p.slug}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-gray-400 uppercase font-semibold mb-1">Latitude</label>
          <input
            type="number"
            step="0.0001"
            value={geo.latitude}
            onChange={(e) => geo.setLatitude(parseFloat(e.target.value) || 0)}
            className="w-full bg-infra-darker border border-infra-accent/40 rounded px-2.5 py-1 text-xs text-white"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 uppercase font-semibold mb-1">Longitude</label>
          <input
            type="number"
            step="0.0001"
            value={geo.longitude}
            onChange={(e) => geo.setLongitude(parseFloat(e.target.value) || 0)}
            className="w-full bg-infra-darker border border-infra-accent/40 rounded px-2.5 py-1 text-xs text-white"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => geo.locateAnalyseAndBudget()}
        disabled={busy}
        className="w-full py-2 bg-infra-highlight text-white text-xs font-bold rounded-lg hover:bg-infra-highlight/90 disabled:opacity-50"
      >
        {busy ? 'Analysing…' : 'Analyse GPS Coordinates'}
      </button>

      {geo.error && (
        <div className="p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{geo.error}</div>
      )}

      {params && (
        <div className="bg-infra-darker p-4 rounded-xl border border-infra-accent/20 space-y-3">
          <h4 className="text-xs font-bold text-gray-300">Local Site Parameters</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Metric label="Province" value={String((params as Record<string, unknown>).province ?? '—')} />
            <Metric label="Buildability" value={exec ? `${exec.buildability_score}/10` : '—'} />
            <Metric label="Wind Vb" value={`${params.design_wind_speed_ms} m/s`} accent="sky" />
            <Metric label="Seismic PGA" value={`${(params as Record<string, unknown>).seismic_pga_g ?? '—'}g`} accent="amber" />
            <Metric label="Rainfall (10yr)" value={`${params.design_rainfall_10yr_mmhr} mm/hr`} accent="emerald" colSpan />
            <Metric label="Soil bearing" value={`${params.soil_bearing_capacity_knm2} kN/m²`} colSpan />
          </div>

          {bcs?.in_zone && (
            <div className="p-2 bg-amber-950/40 border border-amber-500/40 rounded text-xs text-amber-200">
              Black cotton zone: {String(bcs.zone_name)} — {String(zm?.foundation_recommendation ?? 'Deep founding required')}
            </div>
          )}

          {risks.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-gray-500 uppercase">Risk register</div>
              {risks.slice(0, 3).map((r) => (
                <div key={r.risk} className="text-[10px] text-gray-400 flex justify-between gap-2">
                  <span className="truncate">{r.risk}</span>
                  <span className="text-amber-400 shrink-0 uppercase">{r.severity}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => geo.exportSiteReport()}
              className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded"
            >
              Download Site Report
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-600 text-xs font-bold rounded uppercase"
            >
              Push to Calculators
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-500 text-center">
        Unified with Geo Intelligence panel — same cache, same 10-province engine.
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  colSpan,
}: {
  label: string;
  value: string;
  accent?: 'sky' | 'amber' | 'emerald';
  colSpan?: boolean;
}) {
  const color = accent === 'sky' ? 'text-sky-400' : accent === 'amber' ? 'text-amber-400' : accent === 'emerald' ? 'text-emerald-400' : 'text-white';
  return (
    <div className={`bg-[#11192e] p-2 rounded ${colSpan ? 'col-span-2' : ''}`}>
      <span className="text-[10px] text-gray-400 block">{label}</span>
      <span className={`font-mono text-sm font-bold ${color}`}>{value}</span>
    </div>
  );
}

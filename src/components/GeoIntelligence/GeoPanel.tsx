import { useEffect } from 'react';
import { useGeoStore } from '../../store/geoStore';

const COUNTRIES = [
  { code: 'ZM', label: '🇿🇲 Zambia' },
  { code: 'KE', label: '🇰🇪 Kenya' },
  { code: 'NG', label: '🇳🇬 Nigeria' },
  { code: 'GH', label: '🇬🇭 Ghana' },
  { code: 'TZ', label: '🇹🇿 Tanzania' },
  { code: 'ZW', label: '🇿🇼 Zimbabwe' },
  { code: 'BW', label: '🇧🇼 Botswana' },
  { code: 'MZ', label: '🇲🇿 Mozambique' },
];

export function GeoPanel() {
  const {
    latitude,
    longitude,
    countryCode,
    projectName,
    analysis,
    isAnalysing,
    error,
    setLatitude,
    setLongitude,
    setCountryCode,
    setProjectName,
    runSiteAnalysis,
    pushToCalculators,
    exportSiteReport,
    offlineOnly,
    useCache,
    cacheInfo,
    dataSource,
    setOfflineOnly,
    setUseCache,
    loadCacheStatus,
    clearCache,
  } = useGeoStore();

  useEffect(() => {
    loadCacheStatus();
  }, [loadCacheStatus]);

  const exec = analysis?.executive_summary;
  const params = analysis?.design_parameters;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">
          🌍 African Geo Intelligence
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Site Location</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.0001"
              value={latitude}
              onChange={(e) => setLatitude(parseFloat(e.target.value) || 0)}
              placeholder="Latitude"
              className="px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
            />
            <input
              type="number"
              step="0.0001"
              value={longitude}
              onChange={(e) => setLongitude(parseFloat(e.target.value) || 0)}
              placeholder="Longitude"
              className="px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Country</label>
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="Project name"
          className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
        />

        <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded space-y-2">
          <div className="text-xs font-semibold text-gray-400 uppercase">Offline / Field Mode</div>
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={offlineOnly} onChange={(e) => setOfflineOnly(e.target.checked)} />
            Offline only (use cached geo data)
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={useCache} onChange={(e) => setUseCache(e.target.checked)} />
            Cache results for field use
          </label>
          {cacheInfo && (
            <div className="text-xs text-gray-500">
              Cache: {cacheInfo.entries} entries · {cacheInfo.size_kb} KB · TTL {cacheInfo.ttl_hours}h
            </div>
          )}
          <button type="button" onClick={() => clearCache()} className="text-xs text-gray-400 hover:text-white underline">
            Clear geo cache
          </button>
          {dataSource && (
            <div className="text-xs text-infra-highlight">Data source: {dataSource}</div>
          )}
        </div>

        <button
          type="button"
          onClick={() => runSiteAnalysis()}
          disabled={isAnalysing}
          className="w-full py-2 bg-infra-highlight hover:bg-infra-highlight/80 disabled:opacity-50 text-white text-sm font-semibold rounded"
        >
          {isAnalysing ? 'Analysing Site...' : 'RUN SITE ANALYSIS'}
        </button>

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">
            {error}
          </div>
        )}

        {exec && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <SummaryCard
                title="Terrain"
                value={`${exec.buildability_score}/10`}
                sub={exec.buildability_label}
                ok={exec.buildability_score >= 7}
              />
              <SummaryCard
                title="Soil"
                value={exec.soil_conditions.split('—')[0].trim()}
                sub="Investigation required"
                ok={false}
              />
              <SummaryCard
                title="Climate"
                value={`${exec.annual_rainfall_mm}mm`}
                sub={exec.climate_zone}
                ok
              />
              <SummaryCard
                title="Seismic"
                value={String((analysis?.seismic as { seismic_design_category?: string })?.seismic_design_category ?? 'B')}
                sub={exec.seismic_risk}
                ok
              />
            </div>

            {params && (
              <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded">
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                  Design Parameters (ready for calculators)
                </h3>
                <div className="space-y-1 text-xs text-gray-300">
                  <div className="flex justify-between">
                    <span>Bearing Capacity</span>
                    <span>
                      {params.soil_bearing_range_knm2[0]}–{params.soil_bearing_range_knm2[1]} kN/m²
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Design Wind</span>
                    <span>{params.design_wind_speed_ms} m/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Design Rainfall (10yr)</span>
                    <span>{params.design_rainfall_10yr_mmhr} mm/hr</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Foundation Depth Min</span>
                    <span>{params.min_foundation_depth_m} m</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CBR Estimate</span>
                    <span>
                      {params.cbr_range_pct[0]}–{params.cbr_range_pct[1]}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {analysis?.recommendations && (
              <div className="text-xs text-gray-400 space-y-1">
                {analysis.recommendations.slice(0, 4).map((r) => (
                  <div key={r}>• {r}</div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => exportSiteReport()}
                className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded"
              >
                Export Site Report
              </button>
              <button
                type="button"
                onClick={() => pushToCalculators()}
                className="flex-1 py-2 text-xs bg-infra-accent/40 hover:bg-infra-accent/60 rounded text-white"
              >
                Push to Calculators
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  sub,
  ok,
}: {
  title: string;
  value: string;
  sub: string;
  ok: boolean;
}) {
  return (
    <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded text-center">
      <div className="text-xs text-gray-500 uppercase">{title}</div>
      <div className="text-lg font-bold text-white mt-1">{value}</div>
      <div className={`text-xs mt-1 ${ok ? 'text-green-400' : 'text-yellow-400'}`}>
        {sub} {ok ? '✓' : '⚠'}
      </div>
    </div>
  );
}

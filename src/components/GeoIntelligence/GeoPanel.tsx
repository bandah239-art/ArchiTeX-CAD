import { useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGeoStore } from '../../store/geoStore';
import { GeoMap } from './GeoMap';
import { GeoSimulationPanel } from '../Geo/GeoSimulationPanel';

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

const PROJECT_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'institutional', label: 'Institutional' },
];

export function GeoPanel() {
  const { t } = useTranslation();
  const setLocation = useGeoStore((s) => s.setLocation);
  const geo = useGeoStore();
  const [mainTab, setMainTab] = useState<'analysis' | 'sim'>('analysis');

  useEffect(() => {
    geo.loadCacheStatus();
  }, [geo.loadCacheStatus]);

  const onMapPick = useCallback(
    (lat: number, lon: number) => {
      setLocation(lat, lon);
    },
    [setLocation]
  );

  const exec = geo.analysis?.executive_summary;
  const params = geo.analysis?.design_parameters;
  const budget = geo.siteBudget;
  const busy = geo.isAnalysing || geo.isBudgeting;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-infra-accent/30">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">
          🌍 {t('geo.title')}
        </h2>
        <p className="text-[10px] text-gray-500 mt-1">{t('geo.subtitle')}</p>
        <div className="flex gap-1 mt-2">
          {(['analysis', 'sim'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMainTab(tab)}
              className={`flex-1 py-1 text-xs rounded font-medium transition-colors ${
                mainTab === tab
                  ? 'bg-emerald-600 text-white'
                  : 'bg-infra-accent/30 text-gray-400 hover:bg-infra-accent/50'
              }`}
            >
              {tab === 'analysis' ? '🗺 Site Analysis' : '📊 Simulations'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Simulations tab ── */}
        {mainTab === 'sim' && (
          <GeoSimulationPanel inputs={{
            clay_thickness_m: 5,
            cv_m2_yr: 1.5,
            cc: 0.25,
            initial_void_ratio: 0.8,
            sigma0_kpa: 100,
            delta_sigma_kpa: 80,
            slope_height_m: 8,
            slope_angle_deg: 30,
            cohesion_kpa: 15,
            friction_angle_deg: 28,
            soil_unit_weight_knm3: 18,
            pile_length_m: 12,
            pile_diameter_m: 0.4,
            soil_friction_angle_deg: 30,
          }} />
        )}

        {/* ── Site Analysis tab ── */}
        {mainTab === 'analysis' && (<>
        <GeoMap latitude={geo.latitude} longitude={geo.longitude} onLocationChange={onMapPick} />

        {geo.locationLabel && (
          <div className="text-xs text-emerald-400/90 truncate" title={geo.locationLabel}>
            📍 {geo.locationLabel}
          </div>
        )}

        <div className="flex gap-1">
          <input
            type="text"
            value={geo.searchQuery}
            onChange={(e) => geo.setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && geo.searchLocation()}
            placeholder={t('geo.searchPlaceholder')}
            className="flex-1 px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
          />
          <button
            type="button"
            onClick={() => geo.searchLocation()}
            disabled={geo.isSearching}
            className="px-3 py-1.5 text-xs bg-infra-accent/50 hover:bg-infra-accent/70 rounded disabled:opacity-50"
          >
            {geo.isSearching ? '…' : t('geo.search')}
          </button>
        </div>

        {geo.searchResults.length > 0 && (
          <div className="border border-infra-accent/30 rounded overflow-hidden max-h-32 overflow-y-auto">
            {geo.searchResults.map((r, i) => (
              <button
                key={`${r.latitude}-${r.longitude}-${i}`}
                type="button"
                onClick={() => geo.selectSearchResult(r)}
                className="w-full text-left px-2 py-1.5 text-xs text-gray-300 hover:bg-infra-accent/30 border-b border-infra-accent/20 last:border-0"
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-400 mb-1">{t('geo.siteLocation')}</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.0001"
              value={geo.latitude}
              onChange={(e) => geo.setLatitude(parseFloat(e.target.value) || 0)}
              placeholder="Latitude"
              className="px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
            />
            <input
              type="number"
              step="0.0001"
              value={geo.longitude}
              onChange={(e) => geo.setLongitude(parseFloat(e.target.value) || 0)}
              placeholder="Longitude"
              className="px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('geo.country')}</label>
            <select
              value={geo.countryCode}
              onChange={(e) => geo.setCountryCode(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('geo.projectType')}</label>
            <select
              value={geo.projectType}
              onChange={(e) => geo.setProjectType(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
            >
              {PROJECT_TYPES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('geo.gfa')}</label>
            <input
              type="number"
              value={geo.gfaM2}
              onChange={(e) => geo.setGfaM2(Number(e.target.value) || 0)}
              className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('geo.plotArea')}</label>
            <input
              type="number"
              value={geo.platformAreaM2}
              onChange={(e) => geo.setPlatformAreaM2(Number(e.target.value) || 0)}
              className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
            />
          </div>
        </div>

        <input
          type="text"
          value={geo.projectName}
          onChange={(e) => geo.setProjectName(e.target.value)}
          placeholder="Project name"
          className="w-full px-2 py-1.5 text-sm bg-infra-darker border border-infra-accent/40 rounded text-white"
        />

        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={geo.autoAnalyseOnPick}
            onChange={(e) => geo.setAutoAnalyseOnPick(e.target.checked)}
          />
          {t('geo.autoAnalyse')}
        </label>

        <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded space-y-2">
          <div className="text-xs font-semibold text-gray-400 uppercase">{t('geo.offlineMode')}</div>
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={geo.offlineOnly} onChange={(e) => geo.setOfflineOnly(e.target.checked)} />
            {t('geo.offlineOnly')}
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={geo.useCache} onChange={(e) => geo.setUseCache(e.target.checked)} />
            {t('geo.useCache')}
          </label>
          {geo.cacheInfo && (
            <div className="text-xs text-gray-500">
              Cache: {geo.cacheInfo.entries} entries · {geo.cacheInfo.size_kb} KB
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => geo.locateAnalyseAndBudget()}
          disabled={busy}
          className="w-full py-2 bg-infra-highlight hover:bg-infra-highlight/80 disabled:opacity-50 text-white text-sm font-semibold rounded"
        >
          {busy ? t('geo.analysing') : t('geo.locateAnalyseBudget')}
        </button>

        {geo.error && (
          <div className="p-3 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">{geo.error}</div>
        )}

        {budget && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded space-y-2">
            <div className="text-xs font-semibold text-emerald-400 uppercase">{t('geo.siteBudget')}</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <BudgetCell label="Min" value={budget.budget_usd.min} />
              <BudgetCell label="Likely" value={budget.budget_usd.likely} highlight />
              <BudgetCell label="Max" value={budget.budget_usd.max} />
            </div>
            <div className="text-[10px] text-gray-500">{budget.accuracy_note}</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {budget.line_items.map((item) => (
                <div key={item.id} className="flex justify-between text-xs text-gray-300 gap-2">
                  <span className="truncate">{item.label}</span>
                  <span className="text-emerald-300 shrink-0">${item.amount_usd.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => geo.applyBudgetToAi()}
                className="flex-1 py-1.5 text-xs bg-emerald-800/50 hover:bg-emerald-700/50 rounded text-white"
              >
                {t('geo.applyToAi')}
              </button>
              <button
                type="button"
                onClick={() => geo.applyBudgetToBoq()}
                className="flex-1 py-1.5 text-xs border border-emerald-500/40 rounded text-emerald-300"
              >
                {t('geo.applyToBoq')}
              </button>
            </div>
          </div>
        )}

        {exec && (
          <>
            {(geo.analysis as Record<string, unknown>)?.zambia && (
              <ZambiaIntelCard analysis={geo.analysis as Record<string, unknown>} />
            )}

            <div className="grid grid-cols-2 gap-2">
              <SummaryCard title="Terrain" value={`${exec.buildability_score}/10`} sub={exec.buildability_label} ok={exec.buildability_score >= 7} />
              <SummaryCard title="Climate" value={`${exec.annual_rainfall_mm}mm`} sub={exec.climate_zone} ok />
              <SummaryCard title="Seismic" value={String((geo.analysis?.seismic as { seismic_design_category?: string })?.seismic_design_category ?? 'B')} sub={exec.seismic_risk} ok />
              <SummaryCard title="Flood" value={exec.flood_risk} sub="Screening" ok={exec.flood_risk === 'Low'} />
            </div>

            {params && (
              <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded">
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">{t('geo.designParams')}</h3>
                <div className="space-y-1 text-xs text-gray-300">
                  <Row label="Bearing" value={`${params.soil_bearing_range_knm2[0]}–${params.soil_bearing_range_knm2[1]} kN/m²`} />
                  <Row label="Wind" value={`${params.design_wind_speed_ms} m/s`} />
                  <Row label="Rainfall 10yr" value={`${params.design_rainfall_10yr_mmhr} mm/hr`} />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => geo.exportSiteReport()} className="flex-1 py-2 text-xs border border-infra-accent/50 hover:bg-infra-accent/20 rounded">
                {t('geo.exportReport')}
              </button>
              <button type="button" onClick={() => geo.pushToCalculators()} className="flex-1 py-2 text-xs bg-infra-accent/40 hover:bg-infra-accent/60 rounded text-white">
                {t('geo.pushCalc')}
              </button>
            </div>

            <div className="p-3 bg-infra-darker border border-blue-500/30 rounded space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase">{t('geo.floodSim')}</div>
              <button type="button" onClick={() => geo.runFloodSimulation()} disabled={geo.isFloodSimulating} className="w-full py-2 text-xs bg-blue-900/40 hover:bg-blue-900/60 disabled:opacity-50 rounded text-white">
                {geo.isFloodSimulating ? '…' : t('geo.runFlood')}
              </button>
              {geo.floodResult && (
                <div className="text-xs space-y-1 text-gray-300">
                  <Row label="Peak flow" value={`${geo.floodResult.peak_flow_m3s} m³/s`} />
                  <Row label="Flooded area" value={`${geo.floodResult.flooded_area_km2} km²`} />
                </div>
              )}
            </div>
          </>
        )}
        </>)}
      </div>
    </div>
  );
}

function BudgetCell({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded p-2 ${highlight ? 'bg-emerald-900/50 ring-1 ring-emerald-500/50' : 'bg-infra-darker'}`}>
      <div className={`text-sm font-bold ${highlight ? 'text-emerald-300' : 'text-white'}`}>
        ${value.toLocaleString()}
      </div>
      <div className="text-[9px] text-gray-500 uppercase">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="text-blue-300">{value}</span>
    </div>
  );
}

function SummaryCard({ title, value, sub, ok }: { title: string; value: string; sub: string; ok: boolean }) {
  return (
    <div className="p-3 bg-infra-darker border border-infra-accent/30 rounded text-center">
      <div className="text-xs text-gray-500 uppercase">{title}</div>
      <div className="text-lg font-bold text-white mt-1">{value}</div>
      <div className={`text-xs mt-1 ${ok ? 'text-green-400' : 'text-yellow-400'}`}>{sub}</div>
    </div>
  );
}

function ZambiaIntelCard({ analysis }: { analysis: Record<string, unknown> }) {
  const zm = analysis.zambia as Record<string, unknown>;
  const bcs = zm.black_cotton as Record<string, unknown>;
  const risks = (zm.risk_register as Array<Record<string, string>>) ?? [];
  return (
    <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded space-y-2">
      <div className="text-xs font-semibold text-amber-300 uppercase">🇿🇲 Zambia Site Intelligence</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Row label="Province" value={String((zm.province as Record<string, string>)?.display_name ?? '')} />
        <Row label="BCS zone" value={bcs.in_zone ? `Yes — ${bcs.zone_name}` : 'No'} />
        <Row label="Wind Vb" value={`${zm.wind_basic_ms} m/s`} />
        <Row label="PGA" value={`${zm.seismic_pga_g}g`} />
      </div>
      {risks.length > 0 && (
        <div className="text-[10px] text-gray-400 space-y-0.5 max-h-20 overflow-y-auto">
          {risks.slice(0, 4).map((r) => (
            <div key={r.risk} className="flex justify-between gap-2">
              <span className="truncate">{r.risk}</span>
              <span className="text-amber-400 uppercase shrink-0">{r.severity}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

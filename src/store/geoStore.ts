import { create } from 'zustand';
import type { SiteAnalysis } from '../types/boq';
import type { GeocodeResult, SiteBudget } from '../types/geo';
import { geoAPI } from '../services/boqAPI';
import { calculationAPI } from '../services/calculationAPI';
import { useCalculationStore } from './calculationStore';
import { useAiStore } from './aiStore';
import { useBoQStore } from './boqStore';

interface CacheInfo {
  entries: number;
  size_kb: number;
  ttl_hours: number;
}

interface GeoState {
  latitude: number;
  longitude: number;
  countryCode: string;
  projectName: string;
  locationLabel: string;
  projectType: string;
  gfaM2: number;
  platformAreaM2: number;
  autoAnalyseOnPick: boolean;
  searchQuery: string;
  searchResults: GeocodeResult[];
  analysis: SiteAnalysis | null;
  siteBudget: SiteBudget | null;
  isAnalysing: boolean;
  isBudgeting: boolean;
  isSearching: boolean;
  offlineOnly: boolean;
  useCache: boolean;
  cacheInfo: CacheInfo | null;
  dataSource: 'live' | 'cache' | 'offline' | null;
  error: string | null;
  floodResult: Record<string, unknown> | null;
  isFloodSimulating: boolean;
  importedGeoJson: any | null;
  setImportedGeoJson: (data: any | null) => void;
  setLatitude: (v: number) => void;
  setLongitude: (v: number) => void;
  setCountryCode: (code: string) => void;
  setProjectName: (name: string) => void;
  setProjectType: (t: string) => void;
  setGfaM2: (v: number) => void;
  setPlatformAreaM2: (v: number) => void;
  setAutoAnalyseOnPick: (v: boolean) => void;
  setSearchQuery: (q: string) => void;
  setOfflineOnly: (v: boolean) => void;
  setUseCache: (v: boolean) => void;
  loadCacheStatus: () => Promise<void>;
  clearCache: () => Promise<void>;
  setLocation: (lat: number, lon: number, opts?: { autoAnalyse?: boolean }) => Promise<void>;
  searchLocation: (query?: string) => Promise<void>;
  selectSearchResult: (result: GeocodeResult) => Promise<void>;
  runSiteAnalysis: () => Promise<void>;
  computeSiteBudget: () => Promise<void>;
  locateAnalyseAndBudget: () => Promise<void>;
  pushToCalculators: () => void;
  applyBudgetToAi: () => void;
  applyBudgetToBoq: () => void;
  exportSiteReport: () => Promise<void>;
  runFloodSimulation: () => Promise<void>;
}

export const useGeoStore = create<GeoState>((set, get) => ({
  latitude: -15.4167,
  longitude: 28.2833,
  countryCode: 'ZM',
  projectName: 'Lusaka Site',
  locationLabel: 'Lusaka, Zambia',
  projectType: 'residential',
  gfaM2: 142,
  platformAreaM2: 400,
  autoAnalyseOnPick: true,
  searchQuery: '',
  searchResults: [],
  analysis: null,
  siteBudget: null,
  isAnalysing: false,
  isBudgeting: false,
  isSearching: false,
  offlineOnly: false,
  useCache: true,
  cacheInfo: null,
  dataSource: null,
  error: null,
  floodResult: null,
  isFloodSimulating: false,
  importedGeoJson: null,
  setImportedGeoJson: (data) => set({ importedGeoJson: data }),

  setLatitude: (v) => set({ latitude: v }),
  setLongitude: (v) => set({ longitude: v }),
  setCountryCode: (code) => set({ countryCode: code }),
  setProjectName: (name) => set({ projectName: name }),
  setProjectType: (t) => set({ projectType: t }),
  setGfaM2: (v) => set({ gfaM2: v }),
  setPlatformAreaM2: (v) => set({ platformAreaM2: v }),
  setAutoAnalyseOnPick: (v) => set({ autoAnalyseOnPick: v }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setOfflineOnly: (v) => set({ offlineOnly: v }),
  setUseCache: (v) => set({ useCache: v }),

  loadCacheStatus: async () => {
    try {
      const status = await geoAPI.cacheStatus();
      set({
        cacheInfo: {
          entries: status.entries ?? 0,
          size_kb: status.size_kb ?? 0,
          ttl_hours: status.ttl_hours ?? 168,
        },
      });
    } catch {
      set({ cacheInfo: null });
    }
  },

  clearCache: async () => {
    await geoAPI.clearCache();
    await get().loadCacheStatus();
  },

  setLocation: async (lat, lon, opts) => {
    set({ latitude: lat, longitude: lon, error: null });
    try {
      const rev = await geoAPI.reverseGeocode(lat, lon);
      const updates: Partial<GeoState> = {
        locationLabel: rev.display_name,
      };
      if (rev.country_code) updates.countryCode = rev.country_code;
      if (rev.city && get().projectName === 'Lusaka Site') {
        updates.projectName = `${rev.city} Site`;
      }
      set(updates);
    } catch {
      set({ locationLabel: `${lat.toFixed(4)}, ${lon.toFixed(4)}` });
    }
    const auto = opts?.autoAnalyse ?? get().autoAnalyseOnPick;
    if (auto) {
      await get().locateAnalyseAndBudget();
    }
  },

  searchLocation: async (query) => {
    const q = (query ?? get().searchQuery).trim();
    if (q.length < 2) return;
    set({ isSearching: true, error: null, searchQuery: q });
    try {
      const { results } = await geoAPI.geocode(q);
      set({ searchResults: results, isSearching: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Geocode search failed',
        isSearching: false,
        searchResults: [],
      });
    }
  },

  selectSearchResult: async (result) => {
    set({
      latitude: result.latitude,
      longitude: result.longitude,
      locationLabel: result.display_name,
      searchResults: [],
      searchQuery: result.display_name,
    });
    if (result.country_code) set({ countryCode: result.country_code });
    await get().locateAnalyseAndBudget();
  },

  runSiteAnalysis: async () => {
    const { latitude, longitude, countryCode, projectName, offlineOnly, useCache, platformAreaM2 } = get();
    set({ isAnalysing: true, error: null });
    try {
      const analysis = await geoAPI.siteAnalysis({
        latitude,
        longitude,
        country_code: countryCode,
        project_name: projectName,
        platform_area_m2: platformAreaM2,
        use_cache: useCache,
        offline_only: offlineOnly,
      });
      const source = (analysis as SiteAnalysis & { from_cache?: boolean }).from_cache;
      set({
        analysis,
        isAnalysing: false,
        dataSource: source ? 'cache' : offlineOnly ? 'offline' : 'live',
      });
      await get().loadCacheStatus();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Site analysis failed',
        isAnalysing: false,
      });
    }
  },

  computeSiteBudget: async () => {
    const s = get();
    set({ isBudgeting: true, error: null });
    try {
      const siteBudget = await geoAPI.siteBudget({
        latitude: s.latitude,
        longitude: s.longitude,
        country_code: s.countryCode,
        project_name: s.projectName,
        project_type: s.projectType,
        gfa_m2: s.gfaM2,
        platform_area_m2: s.platformAreaM2,
        use_cache: s.useCache,
        offline_only: s.offlineOnly,
      });
      if (siteBudget.site_analysis) {
        set({ analysis: siteBudget.site_analysis });
      }
      set({ siteBudget, isBudgeting: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Site budget failed',
        isBudgeting: false,
      });
    }
  },

  locateAnalyseAndBudget: async () => {
    await get().runSiteAnalysis();
    await get().computeSiteBudget();
  },

  pushToCalculators: () => {
    const params = get().analysis?.design_parameters;
    if (!params) return;
    const calc = useCalculationStore.getState();

    calc.setModule('foundation');
    calc.setInput('soil_bearing', params.soil_bearing_capacity_knm2);
    calc.setInput('foundation_depth', params.min_foundation_depth_m);

    calc.setModule('road');
    calc.setInput('cbr_subgrade', params.cbr_subgrade_pct);
    calc.setInput('rainfall_intensity', params.design_rainfall_10yr_mmhr);

    calc.setModule('loads');
    calc.setInput('wind_load_w', params.design_wind_pressure_knm2);

    calc.setModule('wind');
    calc.setInput('basic_wind_speed', params.design_wind_speed_ms);
  },

  applyBudgetToAi: () => {
    const { siteBudget, countryCode, projectType, analysis } = get();
    if (!siteBudget) return;
    const ai = useAiStore.getState();
    ai.setCountryCode(countryCode);
    ai.setBudgetUsd(siteBudget.suggested_budget_usd);
    ai.setProjectType(projectType);
    if (analysis?.executive_summary) {
      const loc = get().locationLabel.split(',')[0];
      ai.setPrompt(
        `${projectType} building at ${loc}. ` +
          `Site buildability ${analysis.executive_summary.buildability_score}/10. ` +
          `Budget USD ${siteBudget.suggested_budget_usd.toLocaleString()} (site-adjusted).`
      );
    }
  },

  applyBudgetToBoq: () => {
    const { siteBudget, countryCode, projectName } = get();
    if (!siteBudget) return;
    const boq = useBoQStore.getState();
    boq.setCountryCode(countryCode);
    boq.setProjectName(projectName);
  },

  runFloodSimulation: async () => {
    const params = get().analysis?.design_parameters;
    set({ isFloodSimulating: true, error: null });
    try {
      const result = await calculationAPI.simulateFlood({
        rainfall_mm: params?.design_rainfall_10yr_mmhr ?? 80,
        catchment_area_km2: 2.5,
        return_period_years: 100,
        grid_size: 64,
        cell_size_m: 30,
      });
      const summary = result.summary as Record<string, unknown>;
      const floodGrid = (result as unknown as Record<string, unknown>).flood_grid;
      set({
        floodResult: floodGrid ? { ...summary, flood_grid: floodGrid } : summary,
        isFloodSimulating: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Flood simulation failed',
        isFloodSimulating: false,
      });
    }
  },

  exportSiteReport: async () => {
    const { latitude, longitude, countryCode, projectName, offlineOnly, useCache } = get();
    set({ error: null });
    try {
      await geoAPI.siteReport({
        latitude,
        longitude,
        country_code: countryCode,
        project_name: projectName,
        use_cache: useCache,
        offline_only: offlineOnly,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Report export failed' });
    }
  },
}));

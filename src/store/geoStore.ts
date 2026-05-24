import { create } from 'zustand';
import type { SiteAnalysis } from '../types/boq';
import { geoAPI } from '../services/boqAPI';
import { useCalculationStore } from './calculationStore';

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
  analysis: SiteAnalysis | null;
  isAnalysing: boolean;
  offlineOnly: boolean;
  useCache: boolean;
  cacheInfo: CacheInfo | null;
  dataSource: 'live' | 'cache' | 'offline' | null;
  error: string | null;
  setLatitude: (v: number) => void;
  setLongitude: (v: number) => void;
  setCountryCode: (code: string) => void;
  setProjectName: (name: string) => void;
  setOfflineOnly: (v: boolean) => void;
  setUseCache: (v: boolean) => void;
  loadCacheStatus: () => Promise<void>;
  clearCache: () => Promise<void>;
  runSiteAnalysis: () => Promise<void>;
  pushToCalculators: () => void;
  exportSiteReport: () => Promise<void>;
}

export const useGeoStore = create<GeoState>((set, get) => ({
  latitude: -15.4167,
  longitude: 28.2833,
  countryCode: 'ZM',
  projectName: 'Lusaka Site',
  analysis: null,
  isAnalysing: false,
  offlineOnly: false,
  useCache: true,
  cacheInfo: null,
  dataSource: null,
  error: null,

  setLatitude: (v) => set({ latitude: v }),
  setLongitude: (v) => set({ longitude: v }),
  setCountryCode: (code) => set({ countryCode: code }),
  setProjectName: (name) => set({ projectName: name }),
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

  runSiteAnalysis: async () => {
    const { latitude, longitude, countryCode, projectName, offlineOnly, useCache } = get();
    set({ isAnalysing: true, error: null });
    try {
      const analysis = await geoAPI.siteAnalysis({
        latitude,
        longitude,
        country_code: countryCode,
        project_name: projectName,
        use_cache: useCache,
        offline_only: offlineOnly,
      });
      const source = (analysis as SiteAnalysis & { data_source?: string }).data_source;
      set({
        analysis,
        isAnalysing: false,
        dataSource: source === 'cache' ? 'cache' : offlineOnly ? 'offline' : 'live',
      });
      await get().loadCacheStatus();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Site analysis failed',
        isAnalysing: false,
      });
    }
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

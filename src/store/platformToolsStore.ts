import { create } from 'zustand';
import { geoAPI, aiAPI, documentsAPI, governmentAPI, tier3API, boqAPI } from '../services/boqAPI';
import { toBimPayload } from '../services/ifcBoqService';
import { calculationAPI } from '../services/calculationAPI';
import { bimGeometryAPI } from '../services/bimGeometryAPI';
import { geometryExtensionsAPI } from '../services/geometryExtensionsAPI';
import { emergingAPI } from '../services/emergingAPI';
import { platformAPI } from '../services/platformAPI';
import { useGeoStore } from './geoStore';
import { useDrawStore } from './drawStore';
import { useViewerStore } from './viewerStore';
import { useProjectStore } from './projectStore';
import { useIfcModelStore, resolveTwoMeshPayloads, resolvePrimaryMeshPayload, collectTargetEntityIds } from './ifcModelStore';
import { useAiStore } from './aiStore';
import { useBoQStore } from './boqStore';
import { useIntelligenceStore } from './intelligenceStore';
import { useWorkspaceStore } from './workspaceStore';
import { useRealEstateStore } from './realEstateStore';
import { useWashStore } from './washStore';
import { syncGeoOverlaysToViewer } from '../services/geoOverlayEngine';

export interface ToolResult {
  actionId: string;
  label: string;
  summary: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

function geoPayload() {
  const g = useGeoStore.getState();
  return {
    latitude: g.latitude,
    longitude: g.longitude,
    country_code: g.countryCode,
    project_name: g.projectName,
    platform_area_m2: g.platformAreaM2,
    use_cache: g.useCache,
    offline_only: g.offlineOnly,
  };
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadBase64File(filename: string, b64: string, mime: string) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function siteBoundaryVertices(): [number, number][] {
  const el = useDrawStore.getState().elements.find((e) => e.kind === 'site-boundary');
  if (!el || el.points.length < 3) return [];
  return el.points.map((p) => [p.x, p.z]);
}

interface PlatformToolsState {
  isRunning: boolean;
  runningAction: string | null;
  lastResult: ToolResult | null;
  lastError: string | null;
  terrainResult: Record<string, unknown> | null;
  soilResult: Record<string, unknown> | null;
  climateResult: Record<string, unknown> | null;
  geoSeismicResult: Record<string, unknown> | null;
  planTakeoffResult: Record<string, unknown> | null;
  geoOverlayVisibility: { showTerrain: boolean; showContours: boolean; showFlood: boolean };
  runPlatformAction: (actionId: string) => Promise<void>;
  clearResult: () => void;
}

export const usePlatformToolsStore = create<PlatformToolsState>((set, get) => ({
  isRunning: false,
  runningAction: null,
  lastResult: null,
  lastError: null,
  terrainResult: null,
  soilResult: null,
  climateResult: null,
  geoSeismicResult: null,
  planTakeoffResult: null,
  geoOverlayVisibility: { showTerrain: true, showContours: true, showFlood: true },

  clearResult: () => set({ lastResult: null, lastError: null }),

  runPlatformAction: async (actionId: string) => {
    set({ isRunning: true, runningAction: actionId, lastError: null });
    const finish = (label: string, summary: string, data?: Record<string, unknown>) => {
      set({
        isRunning: false,
        runningAction: null,
        lastResult: { actionId, label, summary, data, timestamp: Date.now() },
      });
    };
    const fail = (err: unknown) => {
      set({
        isRunning: false,
        runningAction: null,
        lastError: err instanceof Error ? err.message : String(err),
      });
    };

    try {
      const ws = useWorkspaceStore.getState();
      const project = useProjectStore.getState().currentProject;
      const modelPath = useViewerStore.getState().modelPath;
      const ifc = useIfcModelStore.getState();

      switch (actionId) {
        // ── Geo extended ──
        case 'geo.terrain': {
          ws.openPanel('geo');
          const r = await geoAPI.terrain(geoPayload());
          set({
            terrainResult: r,
            geoOverlayVisibility: { showTerrain: true, showContours: false, showFlood: false },
          });
          syncGeoOverlaysToViewer(r, useGeoStore.getState().floodResult, {
            showTerrain: true,
            showContours: false,
            showFlood: false,
          });
          finish('Terrain', `Slope ${String(r.mean_slope_pct ?? '—')}% · Elev ${String(r.elevation_m ?? '—')}m`, r);
          break;
        }
        case 'geo.soil': {
          ws.openPanel('geo');
          const r = await geoAPI.soil(geoPayload());
          set({ soilResult: r });
          finish('Soil', `Bearing ${String(r.bearing_capacity_kpa ?? r.soil_bearing_kpa ?? '—')} kPa`, r);
          break;
        }
        case 'geo.climate': {
          ws.openPanel('geo');
          const r = await geoAPI.climate(geoPayload());
          set({ climateResult: r });
          finish('Climate', `Wind ${String(r.design_wind_ms ?? '—')} m/s · Rain ${String(r.annual_rainfall_mm ?? '—')} mm`, r);
          break;
        }
        case 'geo.seismic': {
          ws.openPanel('geo');
          const r = await geoAPI.seismic(geoPayload());
          set({ geoSeismicResult: r });
          finish('Seismic hazard', `PGA ${String(r.peak_ground_acceleration_g ?? '—')} g`, r);
          break;
        }
        case 'geo.contours': {
          const r = await geoAPI.terrain(geoPayload());
          set({
            terrainResult: r,
            geoOverlayVisibility: { showTerrain: true, showContours: true, showFlood: false },
          });
          syncGeoOverlaysToViewer(r, useGeoStore.getState().floodResult, {
            showTerrain: true,
            showContours: true,
            showFlood: false,
          });
          finish('Contours', `Generated ${String((r.contour_lines as unknown[])?.length ?? 0)} contour lines`, r);
          break;
        }
        case 'geo.floodOverlay': {
          await useGeoStore.getState().runFloodSimulation();
          const flood = useGeoStore.getState().floodResult;
          set({ geoOverlayVisibility: { showTerrain: false, showContours: false, showFlood: true } });
          syncGeoOverlaysToViewer(get().terrainResult, flood, {
            showTerrain: false,
            showContours: false,
            showFlood: true,
          });
          finish('Flood overlay', `Max depth ${String(flood?.max_flood_depth_m ?? '—')} m`, flood ?? undefined);
          break;
        }
        case 'geo.polygonArea': {
          const verts = siteBoundaryVertices();
          if (verts.length < 3) throw new Error('Draw a site boundary first (Draw tab)');
          const r = await geometryExtensionsAPI.polygonArea(verts);
          finish('Site area', `${r.area.toFixed(1)} m²`, { area: r.area, centroid: r.centroid });
          break;
        }
        case 'geo.regionUnion': {
          const verts = siteBoundaryVertices();
          if (verts.length < 3) throw new Error('Need site boundary polygon');
          const r = await geometryExtensionsAPI.regionBoolean({
            operation: 'union',
            polygons_a: [verts],
            polygons_b: [verts],
          });
          finish('Region union', `Area ${r.area.toFixed(1)} m²`, r as unknown as Record<string, unknown>);
          break;
        }
        case 'geo.regionCut': {
          const verts = siteBoundaryVertices();
          if (verts.length < 3) throw new Error('Need site boundary polygon');
          const inner = verts.map(([x, z]) => [x * 0.9, z * 0.9] as [number, number]);
          const r = await geometryExtensionsAPI.regionBoolean({
            operation: 'difference',
            polygons_a: [verts],
            polygons_b: [inner],
          });
          finish('Region cut', `Area ${r.area.toFixed(1)} m²`, r as unknown as Record<string, unknown>);
          break;
        }
        case 'geo.eia':
          ws.openPanel('geo');
          {
            const r = await documentsAPI.eiaScreening({
              ...geoPayload(),
              project_type: useGeoStore.getState().projectType,
              gfa_m2: useGeoStore.getState().gfaM2,
            });
            finish('EIA screening', String(r.screening_outcome ?? r.status ?? 'Complete'), r);
          }
          break;

        // ── BIM / geometry ──
        case 'bim.planTakeoff': {
          if (!modelPath) throw new Error('Open an IFC model first');
          const r = await bimGeometryAPI.planTakeoff(modelPath);
          set({ planTakeoffResult: r });
          finish('Plan takeoff', `${String(r.wall_count ?? r.footprint_count ?? 0)} wall segments`, r);
          break;
        }
        case 'bim.booleanDiff':
          if (!modelPath) throw new Error('Open IFC first');
          if (collectTargetEntityIds().length < 2) {
            finish(
              'Boolean cut',
              'Select two elements first (pick one, then box-select or pick another)',
            );
            break;
          }
          {
            const { mesh_a, mesh_b } = resolveTwoMeshPayloads();
            const r = await bimGeometryAPI.booleanOperation({
              operation: 'difference',
              mesh_a,
              mesh_b,
            });
            finish('Boolean cut', String(r.status ?? 'Submitted'), r);
          }
          break;
        case 'bim.compareModels':
          if (!modelPath) throw new Error('Open IFC first');
          {
            const ifc = useIfcModelStore.getState();
            const primary = resolvePrimaryMeshPayload();
            const primaryId = collectTargetEntityIds()[0];
            const secondary = ifc.exportMergedModelMesh([primaryId]);
            if (!secondary?.vertices.length) throw new Error('Model has no mesh geometry to compare');
            const r = await bimGeometryAPI.booleanOperation({
              operation: 'difference',
              mesh_a: primary,
              mesh_b: secondary,
            });
            finish('Model compare', String(r.status ?? 'Overlay diff submitted'), r);
          }
          break;
        case 'bim.clash': {
          if (collectTargetEntityIds().length < 2) {
            finish(
              'Clash check',
              'Select two elements first (pick one, then box-select or pick another)',
            );
            break;
          }
          const { mesh_a, mesh_b } = resolveTwoMeshPayloads();
          const r = await bimGeometryAPI.intersectionVolume({
            operation: 'intersection',
            mesh_a,
            mesh_b,
          });
          finish(
            'Clash check',
            `Volume ${String(r.intersection_volume_m3 ?? r.volume_m3 ?? '—')} m³`,
            r,
          );
          break;
        }
        case 'bim.intersectionVolume': {
          if (collectTargetEntityIds().length < 2) {
            finish(
              'Intersection volume',
              'Select two elements first (pick one, then box-select or pick another)',
            );
            break;
          }
          const { mesh_a, mesh_b } = resolveTwoMeshPayloads();
          const r = await bimGeometryAPI.intersectionVolume({
            operation: 'intersection',
            mesh_a,
            mesh_b,
          });
          finish(
            'Intersection volume',
            `${String(r.intersection_volume_m3 ?? r.volume_m3 ?? '—')} m³`,
            r,
          );
          break;
        }
        case 'bim.exportDwg': {
          const path = modelPath ?? project?.ifcPath ?? '';
          const bimElements = toBimPayload(ifc.getBoqElements());
          if (!path && !bimElements.length) {
            throw new Error('Open an IFC model first');
          }
          const r = await geometryExtensionsAPI.exportDwg({
            path,
            elements: bimElements,
          });
          if (r.status === 'complete' && typeof r.dxf_b64 === 'string') {
            downloadBase64File(`infraafrica-plan-${Date.now()}.dxf`, r.dxf_b64, 'application/dxf');
            finish(
              'Export plan',
              String(r.message ?? `DXF downloaded (${bimElements.length} elements)`),
              r,
            );
          } else if (r.status === 'unavailable') {
            finish(
              'Export DWG',
              String(r.error ?? 'AutoCAD bridge not built — install/build InfraAfricaBridge for native DWG'),
              r,
            );
          } else {
            finish('Export DWG', String(r.status ?? r.error ?? 'Done'), r);
          }
          break;
        }
        case 'bim.esg': {
          ws.openPanel('carbon');
          const bimElements = toBimPayload(ifc.getBoqElements());
          if (!bimElements.length) {
            throw new Error('Load an IFC model with measurable elements first');
          }
          const extracted = await boqAPI.extractFromBim({
            elements: bimElements,
            project_id: project?.name ?? 'INFRAFRICA',
          });
          const r = await documentsAPI.esgReport({
            project_name: project?.name ?? 'INFRAFRICA',
            elements: extracted.elements,
            material_totals: extracted.material_totals,
          });
          downloadJson('esg-report.json', r);
          finish(
            'ESG report',
            `${String(r.total_embodied_t_co2e ?? '—')} tCO₂e from ${bimElements.length} elements`,
            r,
          );
          break;
        }
        case 'bim.tender': {
          ws.openPanel('documents');
          const r = await documentsAPI.generateTender({
            project_name: project?.name ?? 'INFRAFRICA',
            country_code: useGeoStore.getState().countryCode,
          });
          finish('Tender pack', String(r.status ?? 'Generated'), r);
          break;
        }
        case 'bim.eia':
          ws.openPanel('documents');
          {
            const r = await documentsAPI.eiaScreening(geoPayload());
            finish('EIA screening', String(r.screening_outcome ?? 'Done'), r);
          }
          break;
        case 'bim.carbonCredits': {
          ws.openPanel('carbon');
          const r = await calculationAPI.calculateCarbonCredits({
            gfa_m2: useGeoStore.getState().gfaM2,
            project_type: useGeoStore.getState().projectType,
          });
          finish('Carbon credits', String(r.summary ?? 'Calculated'), r.summary as Record<string, unknown>);
          break;
        }
        case 'bim.aiVariants': {
          ws.openPanel('ai');
          const ai = useAiStore.getState();
          const r = await aiAPI.generateVariants({
            prompt: ai.prompt,
            country_code: ai.countryCode,
            budget_usd: ai.budgetUsd,
          });
          finish('AI variants', `${String((r.variants as unknown[])?.length ?? 1)} design variants`, r);
          break;
        }
        case 'bim.aiProposal': {
          ws.openPanel('ai');
          const ai = useAiStore.getState();
          const r = await aiAPI.generateProposal({
            prompt: ai.prompt,
            project_name: project?.name,
          });
          downloadJson('ai-proposal.json', r);
          finish('AI proposal', 'Proposal exported', r);
          break;
        }
        case 'bim.calcReport': {
          const r = await platformAPI.calcReport({
            project_name: project?.name ?? 'INFRAFRICA',
          });
          finish('Calculation report', String(r.status ?? 'Generated'), r);
          break;
        }

        // ── Draw export ──
        case 'draw.exportIfc': {
          const sketches = useDrawStore.getState().elements;
          if (!sketches.length) throw new Error('No sketches to export');
          const elements = sketches.map((s, i) => ({
            type: s.kind === 'wall' ? 'IfcWall' : s.kind === 'slab' ? 'IfcSlab' : 'IfcBuildingElementProxy',
            name: `${s.kind}-${i + 1}`,
            globalId: s.id,
            length: s.lengthM,
            width: s.thickness,
            height: s.height,
            volume: (s.lengthM ?? 1) * (s.thickness ?? 0.2) * (s.height ?? 3),
          }));
          const r = await bimGeometryAPI.exportIfc({
            name: project?.name ?? 'Sketch Export',
            site_name: useGeoStore.getState().projectName,
            elements,
          });
          if (r.ifc_bytes_b64) {
            const bytes = Uint8Array.from(atob(r.ifc_bytes_b64), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: 'application/x-step' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sketch-export.ifc';
            a.click();
            URL.revokeObjectURL(url);
          }
          finish('Export sketches', `${elements.length} elements → IFC`, r);
          break;
        }
        case 'draw.polygonArea': {
          const verts = siteBoundaryVertices();
          if (verts.length < 3) throw new Error('Draw site boundary first');
          const r = await geometryExtensionsAPI.polygonArea(verts);
          finish('Polygon area', `${r.area.toFixed(1)} m²`, { area: r.area });
          break;
        }
        case 'draw.farCheck': {
          const verts = siteBoundaryVertices();
          const plotArea = verts.length >= 3 ? (await geometryExtensionsAPI.polygonArea(verts)).area : useGeoStore.getState().platformAreaM2;
          const gfa = useGeoStore.getState().gfaM2;
          const far = plotArea > 0 ? gfa / plotArea : 0;
          finish('FAR check', `FAR ${far.toFixed(2)} · GFA ${gfa}m² / Plot ${plotArea.toFixed(0)}m²`, { far, gfa, plotArea });
          break;
        }

        // ── Structure / roads ──
        case 'structure.pavement': {
          ws.openPanel('calculator');
          const params = useGeoStore.getState().analysis?.design_parameters;
          const r = await calculationAPI.calculatePavement({
            road_class: 'primary',
            traffic_count: 500,
            heavy_vehicle_pct: 10,
            design_life: 15,
            cbr_subgrade: params?.cbr_subgrade_pct ?? 5,
            subbase_material: 'gravel',
            base_material: 'asphalt',
            climate_zone: 'wet',
            country: useGeoStore.getState().countryCode,
          });
          finish('Road pavement', String((r.summary as Record<string, unknown>)?.text ?? r.status ?? 'Designed'), r.summary as Record<string, unknown>);
          break;
        }
        case 'structure.drainage': {
          ws.openPanel('calculator');
          const params = useGeoStore.getState().analysis?.design_parameters;
          const r = await calculationAPI.calculateDrainage({
            catchment_area: 2,
            rainfall_intensity: params?.design_rainfall_10yr_mmhr ?? 80,
            runoff_coefficient: 0.8,
            pipe_gradient: 0.005,
            pipe_material: 'hdpe',
            pipe_length: 100,
            country: 'Zambia',
            region: useGeoStore.getState().locationLabel,
          });
          finish('Road drainage', String((r.summary as Record<string, unknown>)?.text ?? r.status ?? 'Sized'), r.summary as Record<string, unknown>);
          break;
        }
        case 'structure.wind': {
          ws.openPanel('calculator');
          const params = useGeoStore.getState().analysis?.design_parameters;
          const r = await calculationAPI.calculateWind({
            basic_wind_speed: params?.design_wind_speed_ms ?? 30,
            building_height: 10,
            building_width: 20,
            building_length: 30,
            exposure_category: 'B',
          });
          finish('Wind loads', String((r.summary as Record<string, unknown>)?.text ?? r.status ?? 'Calculated'), r.summary as Record<string, unknown>);
          break;
        }
        case 'structure.earthworks': {
          const r = await geoAPI.terrain(geoPayload());
          const cut = Number(r.cut_volume_m3 ?? 0);
          const fill = Number(r.fill_volume_m3 ?? 0);
          finish('Earthworks', `Cut ${cut.toFixed(0)} m³ · Fill ${fill.toFixed(0)} m³`, r);
          break;
        }

        // ── Real estate ──
        case 're.far': {
          ws.openPanel('realestate');
          const verts = siteBoundaryVertices();
          const plotArea = verts.length >= 3 ? (await geometryExtensionsAPI.polygonArea(verts)).area : useGeoStore.getState().platformAreaM2;
          const gfa = useGeoStore.getState().gfaM2;
          const far = plotArea > 0 ? gfa / plotArea : 0;
          finish('FAR check', `FAR ${far.toFixed(2)} · GFA ${gfa}m² / Plot ${plotArea.toFixed(0)}m²`, { far, gfa, plotArea });
          break;
        }
        case 're.setback': {
          const verts = siteBoundaryVertices();
          if (verts.length < 3) throw new Error('Draw site boundary');
          const area = (await geometryExtensionsAPI.polygonArea(verts)).area;
          const setback = area * 0.85;
          finish('Setback zone', `Buildable ~${setback.toFixed(0)} m² (15% setback)`, { buildable_m2: setback });
          break;
        }
        case 're.unitMix': {
          ws.openPanel('realestate');
          const gfa = useGeoStore.getState().gfaM2;
          const units = Math.max(1, Math.floor(gfa / 85));
          finish('Unit mix', `~${units} units @ 85m² GFA/unit`, { units, avg_unit_m2: 85 });
          break;
        }
        case 're.affordable': {
          ws.openPanel('realestate');
          await useRealEstateStore.getState().runFeasibility();
          finish('Affordable housing', 'Feasibility run with site budget', {});
          break;
        }

        // ── WASH extended ──
        case 'wash.rainwater': {
          ws.openPanel('wash');
          const roofArea = useGeoStore.getState().gfaM2 * 0.6;
          const rainfall = useGeoStore.getState().analysis?.design_parameters?.design_rainfall_10yr_mmhr ?? 80;
          const harvest = (roofArea * rainfall * 0.8) / 1000;
          finish('Rainwater harvest', `${harvest.toFixed(1)} m³/event`, { roofArea, harvest_m3: harvest });
          break;
        }
        case 'wash.septic': {
          ws.openPanel('wash');
          const pop = useWashStore.getState().population;
          const rec = pop < 500 ? 'Septic tanks recommended' : 'Sewer network recommended';
          finish('Septic vs sewer', rec, { population: pop });
          break;
        }
        case 'wash.lpcdRural':
          useWashStore.getState().setPopulation(200);
          useWashStore.getState().setLpcd(20);
          finish('WASH preset', 'Rural: 20 LPCD', {});
          break;
        case 'wash.lpcdUrban':
          useWashStore.getState().setLpcd(50);
          finish('WASH preset', 'Urban: 50 LPCD', {});
          break;
        case 'wash.lpcdSchool':
          useWashStore.getState().setLpcd(15);
          finish('WASH preset', 'School: 15 LPCD', {});
          break;
        case 'wash.pumpHead': {
          const pipe = useDrawStore.getState().elements.find((e) => e.kind === 'pipe');
          const len = pipe?.lengthM ?? 50;
          const head = len * 0.05 + 15;
          finish('Pump head', `${head.toFixed(1)} m (est.)`, { length_m: len, head_m: head });
          break;
        }
        case 'wash.boreholeCheck': {
          ws.openPanel('wash');
          useWashStore.getState().setActiveTab('demand');
          await useWashStore.getState().runCalculation();
          useWashStore.getState().setActiveTab('borehole');
          await useWashStore.getState().runCalculation();
          finish('Borehole vs demand', 'Demand and borehole sizing complete', useWashStore.getState().result ?? {});
          break;
        }

        // ── Energy extended ──
        case 'energy.minigrid': {
          ws.openPanel('energy');
          finish('Mini-grid mode', 'Off-grid solar+battery profile applied', { mode: 'minigrid' });
          break;
        }
        case 'energy.roofSolar': {
          ws.openPanel('energy');
          const roof = useGeoStore.getState().gfaM2 * 0.5;
          finish('Roof solar', `${roof.toFixed(0)} m² roof area → ~${(roof * 0.15).toFixed(1)} kWp`, { roof_m2: roof });
          break;
        }

        // ── Government ──
        case 'gov.portfolio': {
          ws.openPanel('government');
          const r = await governmentAPI.portfolioSummary();
          finish('Portfolio', `${String((r.projects as unknown[])?.length ?? r.total_projects ?? '—')} projects`, r);
          break;
        }
        case 'gov.snapshot': {
          ws.openPanel('government');
          const projects = await governmentAPI.listProjects();
          const id = (projects as { id?: string }[])?.[0]?.id ?? 'demo-1';
          const r = await governmentAPI.addSnapshot(id, {
            project_name: project?.name,
            budget_usd: useGeoStore.getState().siteBudget?.suggested_budget_usd,
          });
          finish('Gov snapshot', 'Project snapshot saved', r);
          break;
        }
        case 'gov.certificate': {
          ws.openPanel('government');
          const r = await governmentAPI.generateCertificate('demo-1', { type: 'completion' });
          finish('Certificate', String(r.status ?? 'Generated'), r);
          break;
        }
        case 'gov.cashflow': {
          const r = await platformAPI.govCashflow('demo-1');
          finish('Cashflow', 'Cashflow curve loaded', r);
          break;
        }

        // ── Intelligence ──
        case 'intelligence.ingest': {
          ws.openPanel('intelligence');
          const r = await tier3API.ingestReading({
            asset_id: 'pump-1',
            metric: 'flow_rate',
            value: 42,
            unit: 'L/s',
          });
          finish('Twin ingest', 'Sensor reading ingested', r);
          break;
        }
        case 'intelligence.predictive': {
          ws.openPanel('intelligence');
          const r = await tier3API.analyseAsset('pump-1');
          finish('Predictive maintenance', String(r.risk_level ?? r.status ?? 'Analysis complete'), r);
          break;
        }
        case 'intelligence.collabJoin': {
          ws.openPanel('intelligence');
          await useIntelligenceStore.getState().joinCollab();
          finish('Collab', 'Joined collaboration room', {});
          break;
        }

        // ── Field ──
        case 'field.quickCalc': {
          const r = await platformAPI.mobileQuickCalc({
            module: 'beam',
            span: 6,
            load: 10,
          });
          finish('Field calc', String(r.result ?? 'Quick calc done'), r);
          break;
        }
        case 'field.syncPush': {
          const r = await platformAPI.syncBatch({ items: [], project_id: project?.id ?? 'default' });
          finish('Offline sync', String(r.status ?? 'Sync queued'), r);
          break;
        }

        // ── Emerging ──
        case 'emerging.satellite': {
          ws.openPanel('emerging');
          const g = useGeoStore.getState();
          const r = await emergingAPI.satellite({ latitude: g.latitude, longitude: g.longitude });
          finish('Satellite AI', 'Land-cover analysis complete', r);
          break;
        }
        case 'emerging.drone': {
          ws.openPanel('emerging');
          const r = await emergingAPI.drone({ project_id: project?.id ?? 'default' });
          finish('Drone', String(r.status ?? 'Processing queued'), r);
          break;
        }
        case 'emerging.thermal': {
          ws.openPanel('emerging');
          const r = await emergingAPI.thermal({ gfa_m2: useGeoStore.getState().gfaM2 });
          finish('Thermal sim', String(r.summary ?? 'Simulated'), r);
          break;
        }
        case 'emerging.blockchain': {
          ws.openPanel('emerging');
          const boq = useBoQStore.getState();
          const r = await emergingAPI.blockchain({ hash: boq.compiledBoQ?.project_name ?? project?.name });
          finish('Blockchain', String(r.anchor_id ?? 'Anchored'), r);
          break;
        }
        case 'emerging.voice': {
          const transcript = window.prompt('Voice command (type transcript):', 'run site analysis');
          if (!transcript) break;
          const r = await emergingAPI.voice(transcript);
          finish('Voice', String(r.action ?? r.command ?? 'Processed'), r);
          break;
        }
        case 'emerging.disaster': {
          ws.openPanel('emerging');
          const r = await emergingAPI.disaster({ region: useGeoStore.getState().countryCode });
          finish('Disaster plan', String(r.status ?? 'Plan generated'), r);
          break;
        }
        case 'emerging.cvSafety': {
          ws.openPanel('emerging');
          const r = await emergingAPI.cvSafety({ site: useGeoStore.getState().projectName });
          finish('CV safety', String(r.compliance_pct ?? 'Scan complete'), r);
          break;
        }
        case 'emerging.ar': {
          ws.openPanel('emerging');
          const r = await emergingAPI.arScene({ project_id: project?.id });
          finish('AR scene', String(r.status ?? 'Scene exported'), r);
          break;
        }
        case 'emerging.marketplace': {
          ws.openPanel('emerging');
          const r = await emergingAPI.marketplace(useGeoStore.getState().countryCode);
          finish('Marketplace', `${String((r.listings as unknown[])?.length ?? 0)} materials`, r);
          break;
        }

        // ── BoQ marketplace link ──
        case 'bim.marketplaceBoq': {
          ws.openPanel('emerging');
          const m = await emergingAPI.marketplace(useGeoStore.getState().countryCode);
          ws.openPanel('boq');
          finish('BoQ + marketplace', 'Marketplace prices available for BoQ', m);
          break;
        }

        default:
          set({ isRunning: false, runningAction: null });
      }
    } catch (err) {
      fail(err);
    }
  },
}));

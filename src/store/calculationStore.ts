import { create } from 'zustand';
import type {
  CalculationModule,
  CalculationResult,
  BeamInputs,
  SlabInputs,
  ColumnInputs,
  FoundationInputs,
  LoadInputs,
  PavementInputs,
  DrainageInputs,
  WindInputs,
  SteelInputs,
  TimberInputs,
  RoadSubmodule,
} from '../types/calculations';
import type { IFCElement } from '../types/ifc';
import { calculationAPI } from '../services/calculationAPI';
import { pressureAPI } from '../services/pressureAPI';
import { buildTankPressureInputsFromTreatment } from '../services/treatmentPlantTankInputs';
import { calcInputsFromElement, calcModuleForIfcType } from '../services/selectionBridge';

const DEFAULT_INPUTS: Record<CalculationModule, Record<string, unknown>> = {
  loadCombinations: {
    gk: 15,
    qk: 10,
    wk: 3,
    ek: 0,
    code: 'EC0',
    unit: 'kN/m',
  },
  beam: {
    span: 6,
    support_condition: 'simply_supported',
    dead_load: 15,
    imposed_load: 10,
    width: 300,
    depth: 500,
    fck: 30,
    fyk: 500,
    exposure_class: 'XC1',
    design_code: 'Eurocode2',
  },
  slab: {
    slab_type: 'two_way',
    span_lx: 4,
    span_ly: 5,
    dead_load: 5,
    live_load: 3,
    depth: 175,
    fck: 30,
    fyk: 500,
    support_condition: 'simply_supported',
  },
  column: {
    height: 4,
    width: 300,
    depth: 300,
    axial_load: 850,
    moment_major: 45,
    moment_minor: 20,
    fck: 30,
    fyk: 500,
    le_factor: 0.85,
  },
  foundation: {
    foundation_type: 'pad',
    column_load: 800,
    moment_x: 30,
    moment_y: 0,
    soil_bearing: 150,
    soil_unit_weight: 18,
    foundation_depth: 1.2,
    foundation_width: 1.2,
    foundation_length: 1.0,
    foundation_depth_concrete: 400,
    fck: 25,
    fyk: 500,
    column_width: 300,
    column_depth: 300,
    max_iterations: 200,
  },
  bearing: {
    bearing_type: 'elastomeric',
    vertical_load: 800,
    horizontal_load: 40,
    rotation: 0.01,
    span: 15,
    material: 'concrete',
    fck: 30,
    bearing_width: 300,
    column_width: 200,
    pad_thickness: 20,
    sigma_allow: 10.0,
    horizontal_movement_mm: 40.0,
    layer_thickness_mm: 10.0,
  },
  materials: {
    structure_type: 'beam',
    span: 5.0,
    load: 10.0,
    exposure: 'internal',
    budget: 'medium',
    availability: 'Zambia',
  },
  tank: {
    height: 6,
    radius: 4,
    gamma_w: 9.81,
    wind_force: 120,
    mu: 0.5,
    tank_weight: 800,
  },
  loads: {
    dead_load_g: 20,
    imposed_load_q: 15,
    wind_load_w: 5,
    snow_load_s: 0,
    load_type: 'udl',
    design_code: 'eurocode',
    structure_class: 'ordinary',
  },
  wind: {
    basic_wind_speed: 45,
    building_height: 12,
    building_width: 20,
    building_length: 30,
    exposure_category: 'B',
  },
  road: {
    road_submodule: 'pavement' as RoadSubmodule,
    road_class: 'secondary',
    traffic_count: 500,
    heavy_vehicle_pct: 12,
    design_life: 20,
    cbr_subgrade: 6,
    subbase_material: 'natural_gravel',
    base_material: 'crushed_stone',
    climate_zone: 'semi_arid',
    country: 'Zambia',
    catchment_area: 2.5,
    rainfall_intensity: 65,
    runoff_coefficient: 0.6,
    pipe_gradient: 1.5,
    pipe_material: 'concrete',
    pipe_length: 100,
    region: '',
    design_speed_kmh: 80,
    radius_m: 300,
    max_superelevation_pct: 8.0,
    side_friction_factor: 0.14,
    aadt: 1000,
    growth_rate_pct: 4.0,
    design_life_yrs: 20,
    truck_pct: 10.0,
    bus_pct: 5.0,
    vdf_truck: 3.0,
    vdf_bus: 1.2,
    directional_split: 0.5,
    lane_factor: 1.0,
  },
  wash: {
    wash_submodule: 'water_demand' as any,
    population: 500,
    lpcd: 50,
    context: 'urban_low',
    peak_factor: 2.5,
    storage_days: 1.0,
    leakage_pct: 15,
    country: 'Zambia',
    infiltration_pct: 20,
    material: 'pvc',
    pumping_rate_m3d: 100,
    transmissivity_m2d: 50,
    storage_coeff: 0.001,
    time_days: 1.0,
    radius_m: 0.1,
    aquifer_thickness_m: 20,
    static_lift_m: 30,
    friction_losses_m: 5,
    residual_pressure_m: 15,
    flow_rate_m3h: 100,
    floc_detention_min: 30,
    velocity_gradient_g: 40,
    surface_overflow_rate_mh: 1.5,
    sed_detention_hr: 3,
    filter_type: 'rapid',
    filtration_rate_mh: 10,
    chlorine_contact_min: 30,
    chlorine_residual_mgl: 0.5,
    tank_wind_force_kn: 80,
    tank_friction_mu: 0.5,
  },
  geo: {
    geo_submodule: 'bearing_capacity' as any,
    soil_type: 'sandy',
    foundation_width_m: 2.0,
    foundation_length_m: 2.0,
    foundation_depth_m: 1.2,
    fos: 3.0,
    use_custom_soil: false,
    cohesion_kpa: 0,
    friction_angle_deg: 30,
    unit_weight_knm3: 18,
    applied_pressure_kpa: 150.0,
    poissons_ratio: 0.3,
    elastic_modulus_kpa: 20000.0,
    shape_factor_is: 1.0,
    calc_consolidation: true,
    compression_index_cc: 0.3,
    clay_layer_thickness_m: 5.0,
    initial_void_ratio_e0: 0.8,
    initial_effective_stress_kpa: 50.0,
    stress_increase_kpa: 75.0,
    allowable_settlement_mm: 25.0,
    spt_n: 15,
    energy_ratio: 60,
    borehole_diam_mm: 100,
    sampler_type: 'standard',
    rod_length_m: 5.0,
    effective_stress_kpa: 50.0,
    pga_g: 0.15,
    magnitude: 7.5,
    retaining_wall_height_m: 5,
  },
  pressure: {},
  steel: {
    length: 5,
    fy: 275,
    w: 20,
    Wpl: 721,
    Aw: 22.8,
  },
  timber: {
    length: 4,
    b: 50,
    h: 200,
    fm_k: 24,
    fv_k: 4.0,
    E0_mean: 11000,
    k_mod: 0.8,
    w: 5,
    w_sls: 3.5,
  },
  fea: {
    height: 4.0,
    span: 6.0,
    lateral_load: 20000.0,
    vertical_load: -50000.0,
    support_type: 'fixed',
    E: 2.0e11,
    A: 0.01,
    I: 1.0e-5,
    scale: 20.0,
  },
  energy_bess: {
    load_profile: 'Residential',
    daily_load_kwh: 20,
    peak_load_kw: 5,
    autonomy_days: 2,
    peak_sun_hours: 4.5,
    battery_type: 'lithium_ion',
  },
  energy_microgrid: {
    cable_length_m: 250,
    load_current_amps: 45,
    system_voltage: 230,
    cable_material: 'aluminum',
    max_voltage_drop_percent: 5.0,
  },
  energy_transmission: {
    span_length_m: 50,
    conductor_weight_kg_m: 1.5,
    max_tension_kg: 2000,
    temperature_c: 40,
    ground_clearance_m: 8.0,
  },
  wash_water_tower: {
    population: 500,
    liters_per_capita_day: 50,
    borehole_depth_m: 80,
    tower_height_m: 12,
    pump_efficiency: 0.6,
  },
  wash_epanet: {
    flow_rate_lps: 25,
    pipe_length_m: 500,
    pipe_material: 'HDPE',
    max_velocity_mps: 1.5,
    min_pressure_m: 10,
  },
  wash_dewats: {
    population: 200,
    wastewater_generation_lps_capita: 40,
    influent_bod_mg_l: 300,
    temperature_c: 25,
  },
  energy_grid_fault: {
    generator_kva: 1000,
    generator_voltage_v: 400,
    generator_subtransient_reactance_pu: 0.15,
    cable_length_m: 50,
    cable_reactance_ohm_km: 0.08,
    cable_resistance_ohm_km: 0.16,
  },
  energy_hydro: {
    flow_rate_m3_s: 5.0,
    net_head_m: 25.0,
    system_efficiency: 0.85,
  },
  energy_biogas: {
    cattle_count: 50,
    poultry_count: 0,
    human_count: 10,
    temperature_c: 25,
  },
  energy_wind_wake: {
    turbine_rotor_diameter_m: 80,
    turbine_rating_kw: 2000,
    wind_speed_mps: 12,
    rows: 4,
    spacing_factor_d: 5,
  },
  wash_wtp: {
    flow_rate_m3_d: 5000,
    turbidity_ntu: 50,
  },
  wash_stormwater: {
    catchment_area_ha: 10,
    runoff_coefficient: 0.85,
    rainfall_intensity_mm_hr: 75,
    duration_hours: 2,
  },
  wash_landfill: {
    population: 50000,
    waste_generation_kg_capita_day: 1.2,
    design_life_years: 20,
    compacted_waste_density_kg_m3: 800,
  },
  wash_irrigation: {
    crop_area_ha: 50,
    crop_coefficient_kc: 1.1,
    reference_evapotranspiration_mm_day: 6,
    irrigation_efficiency: 0.85,
  },
  geo_piles: {
    pile_diameter_m: 0.6,
    pile_length_m: 20,
    soil_cohesion_kpa: 50,
    adhesion_factor_alpha: 0.5,
    end_bearing_capacity_factor_nc: 9,
    factor_of_safety: 2.5,
  },
  geo_slope: {
    slope_angle_degrees: 30,
    soil_cohesion_kpa: 20,
    friction_angle_degrees: 25,
    soil_unit_weight_kn_m3: 18,
    slope_height_m: 10,
  },
  geo_consolidation: {
    clay_thickness_m: 5,
    initial_void_ratio: 0.8,
    compression_index_cc: 0.25,
    initial_effective_stress_kpa: 100,
    added_stress_kpa: 50,
  },
  geo_ground_improvement: {
    area_to_improve_m2: 1000,
    column_diameter_m: 0.8,
    column_spacing_m: 2.0,
    pattern: 'triangular',
    depth_m: 8.0,
  },
  geo_tunneling: {
    rqd_percent: 60,
    joint_spacing_rating: 10,
    joint_condition_rating: 12,
    groundwater_rating: 10,
    intact_rock_strength_mpa: 50,
  },
  circuit: {
    shape: 'rc_divider',
  },
  wind_cfd: {
    shape: 'rectangular',
    wind_speed: 10,
    wind_angle: 0,
  },
  seismic: {
    ag: 0.15,
    ground_type: 'B',
    xi_pct: 5.0,
    q: 1.5,
    importance_class: 'II',
    spectrum_type: 1,
    combination: 'SRSS',
    modal_periods: '',
    modal_eff_masses_x: '',
    modal_eff_masses_y: '',
    modal_mass_part_x: '',
  },
  crack_width: {
    b_mm: 300,
    h_mm: 500,
    cover_mm: 35,
    bar_dia_mm: 16,
    n_bars: 3,
    fck_mpa: 30,
    fyk_mpa: 500,
    Es_gpa: 200,
    M_knm: 80,
    N_kn: 0,
    wk_limit_mm: 0.3,
    bond_condition: 'good',
  },
  water_hammer: {
    D_mm: 200,
    t_mm: 6,
    L_m: 500,
    V0_ms: 1.5,
    Tc_s: 0,
    H_static_m: 50,
    E_pipe_gpa: 200,
    pipe_material: 'steel',
    safety_factor: 1.3,
  },
  winkler: {
    L_m: 10,
    B_m: 1.0,
    EI_knm2: 50000,
    ks_knm3: 20000,
    load_type: 'udl',
    q_knm: 50,
    P_kn: 100,
    support: 'free',
  },
};

function asCalculationResult(raw: unknown, fallbackTitle: string): CalculationResult {
  if (raw && typeof raw === 'object' && 'status' in raw && 'steps' in raw) {
    return raw as CalculationResult;
  }
  const record = (raw && typeof raw === 'object' ? raw : { result: raw }) as Record<string, unknown>;
  return {
    status: 'pass',
    summary: flattenSummary(record),
    steps: [
      {
        step_number: 1,
        title: fallbackTitle,
        formula: '',
        substitution: '',
        result: String(record.recommendation ?? record.message ?? 'Complete'),
        unit: '',
        reference: '',
      },
    ],
    warnings: [],
    errors: [],
    timestamp: new Date().toISOString(),
  };
}

function flattenSummary(
  summary: Record<string, unknown> | undefined,
  prefix = ''
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(summary ?? {})) {
    const k = prefix ? `${prefix}_${key}` : key;
    if (typeof value === 'number' || typeof value === 'boolean') {
      out[k] = value;
    } else if (typeof value === 'string') {
      out[k] = value;
    } else if (value != null) {
      out[k] = JSON.stringify(value);
    }
  }
  return out;
}

function terrainCategoryNum(cat: unknown): number {
  const map: Record<string, number> = { '0': 0, I: 1, II: 2, III: 3, IV: 4, A: 0, B: 1, C: 2, D: 3 };
  const s = String(cat ?? 'II');
  return map[s] ?? 2;
}

async function attachPressureOutputs(
  module: CalculationModule,
  result: CalculationResult,
  inputs: Record<string, unknown>
): Promise<CalculationResult> {
  const out = { ...result };
  try {
    if (module === 'road' && ((inputs.road_submodule as string) ?? 'pavement') === 'pavement') {
      out.pressure_pavement = await pressureAPI.pavement({
        P: 80,
        p0: 552,
        asphalt_mm: 100,
        base_mm: 200,
        CBR: inputs.cbr_subgrade ?? 6,
        n_contact_points: 4,
      });
    }
    if (module === 'wind') {
      out.pressure_wind = await pressureAPI.windDistribution({
        vb: inputs.basic_wind_speed ?? 30,
        height: inputs.building_height ?? 12,
        terrain_category: terrainCategoryNum(inputs.exposure_category),
        cpi: 0.2,
      });
    }
    if (module === 'bearing') {
      const hydro = await pressureAPI.bridgeHydrostatic({
        pier_width: (inputs.bearing_width as number) ?? 1.5,
        water_depth: (inputs.water_depth as number) ?? 8,
        gamma_w: 9.81,
        N_total: inputs.vertical_load ?? 800,
      });
      const hydroDyn = await pressureAPI.bridgeHydrodynamic({
        pier_width: (inputs.bearing_width as number) ?? 1.5,
        water_depth: (inputs.water_depth as number) ?? 8,
        velocity: (inputs.flood_velocity as number) ?? 2,
      });
      out.pressure_bridge = {
        ...hydro,
        summary: {
          ...flattenSummary(hydro.summary as Record<string, unknown>),
          ...flattenSummary(hydroDyn.summary as Record<string, unknown>, 'hydrodynamic'),
        },
        steps: [...(hydro.steps ?? []), ...(hydroDyn.steps ?? [])],
        warnings: [...(hydro.warnings ?? []), ...(hydroDyn.warnings ?? [])],
      };
    }
    if (module === 'foundation') {
      out.pressure_boussinesq = await pressureAPI.boussinesq({
        q: inputs.soil_bearing ?? 150,
        B: inputs.foundation_width ?? 1.2,
        L: inputs.foundation_length ?? 1.0,
        z: (inputs.foundation_depth as number) ?? 1.2,
        use_2_1: true,
      });
    }
    if (module === 'geo') {
      const geoSub = (inputs.geo_submodule as string) ?? 'bearing_capacity';
      if (geoSub === 'retaining_wall') {
        out.pressure_lateral = await pressureAPI.lateralEarth({
          phi: inputs.friction_angle ?? 30,
          c: inputs.cohesion ?? 0,
          gamma: inputs.soil_unit_weight ?? 18,
          H: inputs.wall_height ?? 5,
          q: inputs.surcharge ?? 0,
        });
      }
      if (geoSub === 'settlement') {
        out.pressure_consolidation = await pressureAPI.consolidation({
          delta_sigma: inputs.stress_increase_kpa ?? 75,
          water_table_depth: inputs.water_table_depth ?? 1.5,
          OCR: inputs.ocr ?? 1.0,
          layer_gamma: inputs.soil_unit_weight ?? 18,
          layer_thickness: 5,
        });
      }
    }
    if (module === 'wash') {
      const washSub = (inputs.wash_submodule as string) ?? 'water_demand';
      if (washSub === 'pipe_network') {
        out.pressure_pipe = await pressureAPI.pipe({
          P_node: inputs.node_pressure_kpa ?? 300,
          diameter_mm: inputs.pipe_diameter_mm ?? 200,
          wall_mm: inputs.pipe_wall_thickness_mm ?? 10,
          material: inputs.pipe_material ?? 'HDPE',
        });
      }
      if (washSub === 'treatment_plant') {
        out.pressure_tank = await pressureAPI.tank(
          buildTankPressureInputsFromTreatment(inputs, (result.summary ?? {}) as Record<string, unknown>)
        );
      }
    }
    if (module === 'tank') {
      out.pressure_tank = await pressureAPI.tank(inputs as any);
    }
  } catch {
    /* supplementary pressure — must not fail parent calculation */
  }
  return out;
}

function mergeWithDefaults(
  module: CalculationModule,
  inputs: Record<string, unknown>
): Record<string, unknown> {
  return { ...DEFAULT_INPUTS[module], ...inputs };
}

function roundLoad(v: number): number {
  return Math.round(v * 100) / 100;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string') {
    return (err as Error).message;
  }
  return 'Calculation failed';
}

interface CalculationState {
  activeModule: CalculationModule;
  currentInputs: Record<string, unknown>;
  currentResults: CalculationResult | null;
  savedCalculations: CalculationResult[];
  isCalculating: boolean;
  error: string | null;
  setModule: (module: CalculationModule) => void;
  prefillFromElement: (element: IFCElement) => CalculationModule | null;
  setInput: (key: string, value: unknown) => void;
  setInputs: (inputs: Record<string, unknown>) => void;
  applyGoverningLoad: (target: 'beam' | 'slab' | 'foundation', designLoad: number) => void;
  runCalculation: () => Promise<void>;
  saveResult: (result: CalculationResult) => void;
  clearResults: () => void;
}

export const useCalculationStore = create<CalculationState>((set, get) => ({
  activeModule: 'beam',
  currentInputs: DEFAULT_INPUTS.beam,
  currentResults: null,
  savedCalculations: [],
  isCalculating: false,
  error: null,

  setModule: (module) =>
    set({
      activeModule: module,
      currentInputs: DEFAULT_INPUTS[module],
      currentResults: null,
      error: null,
    }),

  prefillFromElement: (element) => {
    const module = calcModuleForIfcType(element.type);
    if (!module) return null;
    const inputs = mergeWithDefaults(module, calcInputsFromElement(element));
    set({
      activeModule: module,
      currentInputs: inputs,
      currentResults: null,
      error: null,
    });
    return module;
  },

  setInput: (key, value) => {
    set({ currentInputs: { ...get().currentInputs, [key]: value } });
  },

  setInputs: (inputs) => set({ currentInputs: inputs }),

  applyGoverningLoad: (target, designLoad) => {
    const w = roundLoad(designLoad);
    const base = { ...DEFAULT_INPUTS[target] };
    if (target === 'beam') {
      set({
        activeModule: 'beam',
        currentInputs: { ...base, dead_load: w, imposed_load: 0 },
        currentResults: null,
        error: null,
      });
      return;
    }
    if (target === 'slab') {
      set({
        activeModule: 'slab',
        currentInputs: { ...base, dead_load: w, live_load: 0 },
        currentResults: null,
        error: null,
      });
      return;
    }
    set({
      activeModule: 'foundation',
      currentInputs: { ...base, column_load: w },
      currentResults: null,
      error: null,
    });
  },

  runCalculation: async () => {
    const { activeModule, currentInputs } = get();
    const inputs = mergeWithDefaults(activeModule, currentInputs);
    set({ isCalculating: true, error: null, currentInputs: inputs });

    try {
      let result: CalculationResult;

      switch (activeModule) {
        case 'loadCombinations':
          throw new Error('Use Generate Combinations in the Load Combinations tab');
        case 'beam':
          result = await calculationAPI.calculateBeam(inputs as unknown as BeamInputs);
          break;
        case 'slab':
          result = await calculationAPI.calculateSlab(inputs as unknown as SlabInputs);
          break;
        case 'column':
          result = await calculationAPI.calculateColumn(inputs as unknown as ColumnInputs);
          break;
        case 'foundation':
          result = await calculationAPI.calculateFoundation(inputs as unknown as FoundationInputs);
          break;
        case 'loads':
          result = await calculationAPI.calculateLoads(inputs as unknown as LoadInputs);
          break;
        case 'wind':
          result = await calculationAPI.calculateWind(inputs as unknown as WindInputs);
          break;
        case 'bearing':
          result = await calculationAPI.calculateBearing(inputs);
          break;
        case 'materials':
          result = await calculationAPI.recommendMaterial(inputs);
          break;
        case 'road': {
          const submodule = (inputs.road_submodule as string) ?? 'pavement';
          if (submodule === 'drainage') {
            result = await calculationAPI.calculateDrainage(inputs as unknown as DrainageInputs);
          } else if (submodule === 'geometric_design') {
            result = await calculationAPI.calculateGeometricDesign(inputs as unknown as Record<string, unknown>);
          } else if (submodule === 'traffic_load') {
            result = await calculationAPI.calculateTrafficLoad(inputs as unknown as Record<string, unknown>);
          } else {
            result = await calculationAPI.calculatePavement(inputs as unknown as PavementInputs);
          }
          break;
        }
        case 'wash': {
          const submodule = (inputs.wash_submodule as string) ?? 'water_demand';
          if (submodule === 'pipe_network') {
            result = await calculationAPI.calculateWashPipeNetwork(inputs);
          } else if (submodule === 'sewer_design') {
            result = await calculationAPI.calculateWashSewerDesign(inputs);
          } else if (submodule === 'borehole') {
            result = await calculationAPI.calculateWashBorehole(inputs);
          } else if (submodule === 'treatment_plant') {
            result = await calculationAPI.calculateWashTreatmentPlant(inputs);
          } else {
            result = await calculationAPI.calculateWashWaterDemand(inputs);
          }
          break;
        }
        case 'geo': {
          const submodule = (inputs.geo_submodule as string) ?? 'bearing_capacity';
          if (submodule === 'settlement') {
            result = await calculationAPI.calculateGeoSettlement(inputs);
          } else if (submodule === 'slope_stability') {
            result = await calculationAPI.calculateGeoSlopeStability(inputs);
          } else if (submodule === 'site_classification') {
            result = await calculationAPI.calculateGeoSiteClassification(inputs);
          } else {
            result = await calculationAPI.calculateGeoBearingCapacity(inputs);
          }
          break;
        }
        case 'tank': {
          result = await pressureAPI.tank(inputs as any) as any;
          break;
        }
        case 'steel':
          result = await calculationAPI.calculateSteel(inputs as unknown as SteelInputs);
          break;
        case 'timber':
          result = await calculationAPI.calculateTimber(inputs as unknown as TimberInputs);
          break;
        case 'fea':
          result = await calculationAPI.calculateFea(inputs);
          break;
        case 'pressure':
          throw new Error('Use CALCULATE PRESSURE in the Pressure tab');
        case 'energy_bess':
          result = asCalculationResult(
            await calculationAPI.calculateEnergyBess(inputs),
            'BESS & Solar sizing',
          );
          break;
        case 'energy_microgrid': {
          const raw = (await calculationAPI.calculateEnergyMicrogrid(
            inputs,
          )) as unknown as Record<string, unknown>;
          result = asCalculationResult(raw, 'Microgrid cable');
          const maxDrop = (inputs.max_voltage_drop_percent as number) ?? 5;
          const actual = raw.actual_voltage_drop_percent as number | undefined;
          if (typeof actual === 'number' && actual > maxDrop) result.status = 'fail';
          break;
        }
        case 'energy_transmission':
          result = asCalculationResult(
            await calculationAPI.calculateEnergyTransmission(inputs),
            'Sag-tension',
          );
          break;
        case 'wash_water_tower':
          result = asCalculationResult(
            await calculationAPI.calculateWashWaterTower(inputs),
            'Water tower & pump',
          );
          break;
        case 'wash_epanet':
          result = asCalculationResult(
            await calculationAPI.calculateWashEpanet(inputs),
            'Pipe network (EPANET)',
          );
          break;
        case 'wash_dewats':
          result = asCalculationResult(
            await calculationAPI.calculateWashDewats(inputs),
            'DEWATS facility',
          );
          break;
        case 'energy_grid_fault':
          result = asCalculationResult(
            await calculationAPI.calculateEnergyGridFault(inputs),
            'Grid fault current',
          );
          break;
        case 'energy_hydro':
          result = asCalculationResult(
            await calculationAPI.calculateEnergyHydro(inputs),
            'Hydro power',
          );
          break;
        case 'energy_biogas':
          result = asCalculationResult(
            await calculationAPI.calculateEnergyBiogas(inputs),
            'Biogas digester',
          );
          break;
        case 'energy_wind_wake': {
          const raw = (await calculationAPI.calculateEnergyWindWake(
            inputs,
          )) as unknown as Record<string, unknown>;
          result = asCalculationResult(raw, 'Wind farm wake');
          const eff = raw.farm_efficiency_percent as number | undefined;
          if (typeof eff === 'number' && eff < 85) result.status = 'warning';
          break;
        }
        case 'wash_wtp':
          result = asCalculationResult(
            await calculationAPI.calculateWashWtp(inputs),
            'Water treatment plant',
          );
          break;
        case 'wash_stormwater':
          result = asCalculationResult(
            await calculationAPI.calculateWashStormwater(inputs),
            'Stormwater',
          );
          break;
        case 'wash_landfill':
          result = asCalculationResult(
            await calculationAPI.calculateWashLandfill(inputs),
            'Sanitary landfill',
          );
          break;
        case 'wash_irrigation':
          result = asCalculationResult(
            await calculationAPI.calculateWashIrrigation(inputs),
            'Irrigation',
          );
          break;
        case 'geo_piles':
          result = asCalculationResult(
            await calculationAPI.calculateGeoPiles(inputs),
            'Pile capacity',
          );
          break;
        case 'geo_slope': {
          const raw = (await calculationAPI.calculateGeoSlope(inputs)) as unknown as Record<
            string,
            unknown
          >;
          result = asCalculationResult(raw, 'Slope stability');
          const st = String(raw.status ?? '');
          if (st === 'unsafe') result.status = 'fail';
          else if (st === 'warning') result.status = 'warning';
          break;
        }
        case 'geo_consolidation':
          result = asCalculationResult(
            await calculationAPI.calculateGeoConsolidation(inputs),
            'Consolidation settlement',
          );
          break;
        case 'geo_ground_improvement':
          result = asCalculationResult(
            await calculationAPI.calculateGeoGroundImprovement(inputs),
            'Ground improvement',
          );
          break;
        case 'geo_tunneling': {
          const raw = (await calculationAPI.calculateGeoTunneling(
            inputs,
          )) as unknown as Record<string, unknown>;
          result = asCalculationResult(raw, 'Tunnel rock mass');
          const rmr = raw.rmr_score as number | undefined;
          if (typeof rmr === 'number' && rmr < 40) result.status = 'warning';
          break;
        }
        default:
          throw new Error(`Unknown module: ${activeModule}`);
      }

      const withPressure = await attachPressureOutputs(activeModule, result, inputs);
      set({ currentResults: withPressure, isCalculating: false });

      // Persist to Electron offline SQLite when available
      if (window.electronAPI?.offlineSaveCalculation) {
        const projectId = 'default';
        void window.electronAPI.offlineSaveCalculation(
          crypto.randomUUID(),
          projectId,
          activeModule,
          inputs as Record<string, unknown>,
          result as unknown as Record<string, unknown>
        );
      }
    } catch (err) {
      set({
        error: getErrorMessage(err),
        isCalculating: false,
      });
    }
  },

  saveResult: (result) => {
    set({ savedCalculations: [...get().savedCalculations, result] });
  },

  clearResults: () => set({ currentResults: null, error: null }),
}));

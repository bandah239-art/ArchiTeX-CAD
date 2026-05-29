import type { SketchElement, SketchKind } from '../store/drawStore';

export interface SketchBoQItem {
  description: string;
  unit: string;
  qty: number;
  rate_zmw: number;
  total_zmw: number;
  source_element_id: string;
  code: string;
  category: string;
}

// Zambia market rates (ZMW) — approximate mid-2025
const ZMW: Record<string, number> = {
  concrete_c20_m3:    1_850,
  concrete_c25_m3:    2_100,
  steel_y12_tonne:   12_500,
  steel_r10_tonne:   11_800,
  formwork_m2:          285,
  blocks_230mm_nr:       22,
  blocks_110mm_nr:       18,
  mortar_m3:            650,
  plaster_m2:            45,
  hdpe_110_m:           185,
  hdpe_90_m:            155,
  hdpe_63_m:            110,
  pvc_110_m:            140,
  excavation_m3:         95,
  backfill_m3:           65,
  hardcore_m3:          120,
  blinding_m3:        1_650,
  dpc_m2:               35,
  paint_m2:             38,
  roofing_IBR_m2:      320,
  timber_m3:          4_200,
};

function r(n: number, dp = 2): number {
  return +n.toFixed(dp);
}

// Map element kind to relevant calculator module
export const KIND_TO_CALC: Partial<Record<SketchKind, { module: string; label: string; inputs: (el: SketchElement) => Record<string, number | string> }>> = {
  wall: {
    module: 'masonry',
    label: 'Masonry Design (BS 5628)',
    inputs: (el) => ({
      t_mm:               r((el.thickness ?? 0.225) * 1000, 0),
      h_m:                r(el.height ?? 3, 2),
      L_m:                r(el.lengthM ?? 4, 2),
      N_kn_m:             10,
      load_type:          'udl',
      wall_condition:     'normal',
      restraint_top:      'restrained',
      restraint_bottom:   'restrained',
    }),
  },
  slab: {
    module: 'slab',
    label: 'Slab Design (BS 8110)',
    inputs: (el) => {
      const side = r(Math.sqrt(el.areaM2 ?? 25), 2);
      return {
        span_lx:          side,
        span_ly:          side,
        depth:            r((el.thickness ?? 0.175) * 1000, 0),
        dead_load:        5,
        live_load:        2.5,
        design_code:      'BS8110',
        slab_type:        'two_way',
        support_condition:'simply_supported',
      };
    },
  },
  column: {
    module: 'column',
    label: 'Column Design (BS 8110)',
    inputs: (el) => ({
      height:             r(el.height ?? 3, 2),
      width:              r((el.thickness ?? 0.3) * 1000, 0),
      depth:              r((el.thickness ?? 0.3) * 1000, 0),
      axial_load:         500,
      moment_major:       30,
      design_code:        'BS8110',
    }),
  },
  pipe: {
    module: 'wash_epanet',
    label: 'Pipe Network Analysis',
    inputs: (el) => ({
      pipe_length_m:      r(el.lengthM ?? 100, 1),
      pipe_diameter_mm:   r((el.diameter ?? 0.11) * 1000, 0),
    }),
  },
  rectangle: {
    module: 'foundation',
    label: 'Foundation Design',
    inputs: (el) => ({
      foundation_width:   r(el.thickness ?? 1.2, 2),
      foundation_length:  r(el.lengthM ?? 1.2, 2),
      depth:              0.5,
      soil_bearing_kpa:   100,
    }),
  },
  polygon: {
    module: 'foundation',
    label: 'Foundation Design',
    inputs: (el) => ({
      foundation_width:   r(Math.sqrt(el.areaM2 ?? 1.44), 2),
      foundation_length:  r(Math.sqrt(el.areaM2 ?? 1.44), 2),
      depth:              0.5,
      soil_bearing_kpa:   100,
    }),
  },
};

export function sketchElementsToBoQ(elements: SketchElement[]): SketchBoQItem[] {
  const items: SketchBoQItem[] = [];

  for (const el of elements) {
    switch (el.kind) {

      case 'wall': {
        const wallArea  = r((el.lengthM ?? 0) * (el.height ?? 3), 3);
        const t         = el.thickness ?? 0.225;
        const blockNr   = Math.ceil(wallArea / (0.23 * 0.115) * 1.05); // 5% waste
        const mortarM3  = r(wallArea * t * 0.30, 3);
        const plasterM2 = r(wallArea * 2, 2);

        items.push({
          description: `Masonry wall t=${r(t * 1000, 0)}mm — L=${r(el.lengthM ?? 0, 2)}m h=${r(el.height ?? 3, 2)}m`,
          unit: 'Nr', qty: blockNr, rate_zmw: ZMW.blocks_230mm_nr,
          total_zmw: r(blockNr * ZMW.blocks_230mm_nr, 0),
          source_element_id: el.id, code: 'F10', category: 'Masonry',
        });
        items.push({
          description: 'Mortar — bedding and jointing',
          unit: 'm³', qty: mortarM3, rate_zmw: ZMW.mortar_m3,
          total_zmw: r(mortarM3 * ZMW.mortar_m3, 0),
          source_element_id: el.id, code: 'F10.2', category: 'Masonry',
        });
        items.push({
          description: 'Cement plaster 15mm both faces',
          unit: 'm²', qty: plasterM2, rate_zmw: ZMW.plaster_m2,
          total_zmw: r(plasterM2 * ZMW.plaster_m2, 0),
          source_element_id: el.id, code: 'M20', category: 'Finishes',
        });
        break;
      }

      case 'slab': {
        const thick    = el.thickness ?? 0.175;
        const area     = el.areaM2 ?? 0;
        const concM3   = r(area * thick, 3);
        const steelT   = r(area * 8 / 1000, 4);   // 8 kg/m² estimate
        items.push({
          description: `RC Slab C25 t=${r(thick * 1000, 0)}mm — ${r(area, 2)} m²`,
          unit: 'm³', qty: concM3, rate_zmw: ZMW.concrete_c25_m3,
          total_zmw: r(concM3 * ZMW.concrete_c25_m3, 0),
          source_element_id: el.id, code: 'E10', category: 'Concrete',
        });
        items.push({
          description: 'HY steel Y12@200 EW reinforcement',
          unit: 'Tonne', qty: steelT, rate_zmw: ZMW.steel_y12_tonne,
          total_zmw: r(steelT * ZMW.steel_y12_tonne, 0),
          source_element_id: el.id, code: 'E30', category: 'Concrete',
        });
        items.push({
          description: 'Soffit formwork to slab underside',
          unit: 'm²', qty: r(area, 2), rate_zmw: ZMW.formwork_m2,
          total_zmw: r(area * ZMW.formwork_m2, 0),
          source_element_id: el.id, code: 'E20', category: 'Concrete',
        });
        break;
      }

      case 'column': {
        const h       = el.height ?? 3;
        const b       = el.thickness ?? 0.3;
        const concM3  = r(b * b * h, 4);
        const steelT  = r(concM3 * 2500 * 0.02 / 1000, 4);
        items.push({
          description: `RC Column C25 ${r(b * 1000, 0)}×${r(b * 1000, 0)}mm h=${r(h, 2)}m`,
          unit: 'm³', qty: concM3, rate_zmw: ZMW.concrete_c25_m3,
          total_zmw: r(concM3 * ZMW.concrete_c25_m3, 0),
          source_element_id: el.id, code: 'E10.2', category: 'Concrete',
        });
        items.push({
          description: 'HY steel links + main bars in column',
          unit: 'Tonne', qty: steelT, rate_zmw: ZMW.steel_y12_tonne,
          total_zmw: r(steelT * ZMW.steel_y12_tonne, 0),
          source_element_id: el.id, code: 'E30.2', category: 'Concrete',
        });
        break;
      }

      case 'pipe': {
        const len  = el.lengthM ?? 0;
        const dMm  = (el.diameter ?? 0.11) * 1000;
        const rate = dMm >= 110 ? ZMW.hdpe_110_m : dMm >= 90 ? ZMW.hdpe_90_m : ZMW.hdpe_63_m;
        items.push({
          description: `HDPE pipe supply and lay Ø${r(dMm, 0)}mm — ${r(len, 2)}m run`,
          unit: 'm', qty: r(len, 2), rate_zmw: rate,
          total_zmw: r(len * rate, 0),
          source_element_id: el.id, code: 'R12', category: 'WASH',
        });
        const trenchM3 = r(len * 0.6 * 0.8, 2);
        items.push({
          description: 'Pipe trench excavation 600mm wide',
          unit: 'm³', qty: trenchM3, rate_zmw: ZMW.excavation_m3,
          total_zmw: r(trenchM3 * ZMW.excavation_m3, 0),
          source_element_id: el.id, code: 'D20', category: 'Earthworks',
        });
        break;
      }

      case 'rectangle':
      case 'polygon': {
        // Treat as pad foundation or floor slab
        const area    = el.areaM2 ?? 0;
        const thick   = el.thickness ?? 0.3;
        const concM3  = r(area * thick, 3);
        items.push({
          description: `RC foundation slab C20 t=${r(thick * 1000, 0)}mm — ${r(area, 2)} m²`,
          unit: 'm³', qty: concM3, rate_zmw: ZMW.concrete_c20_m3,
          total_zmw: r(concM3 * ZMW.concrete_c20_m3, 0),
          source_element_id: el.id, code: 'E05', category: 'Substructure',
        });
        break;
      }

      case 'line':
      case 'polyline': {
        if (!el.lengthM) break;
        items.push({
          description: `Road / boundary line — ${r(el.lengthM, 2)}m`,
          unit: 'm', qty: r(el.lengthM, 2), rate_zmw: 0,
          total_zmw: 0,
          source_element_id: el.id, code: 'Q10', category: 'Roads',
        });
        break;
      }

      default:
        break;
    }
  }

  return items;
}

export function boqSummary(items: SketchBoQItem[]): { category: string; total_zmw: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.category, (map.get(item.category) ?? 0) + item.total_zmw);
  }
  return Array.from(map.entries()).map(([category, total_zmw]) => ({ category, total_zmw }));
}

import type { PressureDiagramData } from '../../../services/pressureAPI';
import type { PressureModule } from '../../../services/pressureAPI';

/** Schematic previews shown before the first calculate (same diagram types as the API). */
export const PRESSURE_DIAGRAM_PLACEHOLDERS: Partial<Record<PressureModule, PressureDiagramData>> = {
  'foundation-bearing': {
    type: 'trapezoidal',
    points: [{ pressure: 120 }, { pressure: 200 }, { pressure: 180 }],
    labels: ['q_min', 'q_max', 'q_avg — run calculate for project values'],
  },
  'lateral-earth': {
    type: 'triangular',
    points: [
      { depth_m: 0, pressure: 0 },
      { depth_m: 2.5, pressure: 30 },
      { depth_m: 5, pressure: 60 },
    ],
    labels: ['Ka·γ·z + 2c√Ka'],
  },
  'wind-distribution': {
    type: 'arrows',
    points: [
      { zone: 'windward', pressure_kpa: -0.8 },
      { zone: 'leeward', pressure_kpa: 0.5 },
      { zone: 'side', pressure_kpa: -0.4 },
    ],
    labels: ['Wind zones — run calculate for qp'],
  },
  boussinesq: {
    type: 'contour',
    points: [
      { depth_m: 0, pressure_kpa: 200 },
      { depth_m: 0.5, pressure_kpa: 120 },
      { depth_m: 1, pressure_kpa: 80 },
    ],
    labels: ['σz below footing'],
    footprint: { B: 2.5, L: 3 },
  },
  consolidation: {
    type: 'triangular',
    points: [
      { depth_m: 0, pressure: 18 },
      { depth_m: 2.5, pressure: 36 },
      { depth_m: 5, pressure: 54 },
    ],
    labels: ['σ′ profile with water table'],
  },
  'bridge-hydrostatic': {
    type: 'triangular',
    points: [
      { depth_m: 0, pressure: 0 },
      { depth_m: 4, pressure: 39 },
      { depth_m: 8, pressure: 78 },
    ],
    labels: ['p = γw·h'],
  },
  'bridge-hydrodynamic': {
    type: 'triangular',
    points: [
      { depth_m: 0, pressure: 0 },
      { depth_m: 8, pressure: 25 },
    ],
    labels: ['Hydrodynamic on pier'],
  },
  'bridge-foundation': {
    type: 'trapezoidal',
    points: [{ pressure: 150 }, { pressure: 220 }],
    labels: ['Pile group bearing'],
  },
  'pavement-pressure': {
    type: 'uniform',
    points: [{ pressure: 552 }, { pressure: 552 }],
    labels: ['Tyre contact pressure'],
  },
  'pipe-pressure': {
    type: 'uniform',
    points: [{ pressure: 320 }],
    labels: ['Node pressure P (kPa)'],
  },
  'tank-pressure': {
    type: 'triangular',
    points: [
      { y: 0, pressure: 0 },
      { y: 3, pressure: 29 },
      { y: 6, pressure: 59 },
    ],
    labels: ['Hydrostatic on tank wall'],
  },
};

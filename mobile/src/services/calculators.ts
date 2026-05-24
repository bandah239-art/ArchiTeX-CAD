export const MIX_RATIOS: Record<string, { cement: number; sand: number; aggregate: number; water: number }> = {
  C20: { cement: 3.2, sand: 0.14, aggregate: 0.28, water: 170 },
  C25: { cement: 3.5, sand: 0.15, aggregate: 0.30, water: 58 },
  C30: { cement: 3.8, sand: 0.14, aggregate: 0.28, water: 55 },
};

export const REBAR_KG: Record<string, number> = {
  H10: 0.617, H12: 0.888, H16: 1.579, H20: 2.466, H25: 3.854, H32: 6.313,
};

export function concreteMix(grade: string, volume: number) {
  const r = MIX_RATIOS[grade] ?? MIX_RATIOS.C25;
  return {
    cement_bags: Math.round(r.cement * volume * 10) / 10,
    sand_m3: Math.round(r.sand * volume * 100) / 100,
    aggregate_m3: Math.round(r.aggregate * volume * 100) / 100,
    water_litres: Math.round(r.water * volume),
  };
}

export function rebarWeight(size: string, length: number, qty: number) {
  const kgpm = REBAR_KG[size] ?? 1.579;
  const total = kgpm * length * qty;
  return { total_kg: Math.round(total * 10) / 10, total_tonnes: Math.round(total / 10) / 100 };
}

export function beamCheck(span: number, depth: number) {
  const ld = (span * 1000) / depth;
  return { ld_ratio: Math.round(ld * 10) / 10, limit: 26, status: ld <= 26 ? 'PASS' : 'CHECK REQUIRED' };
}

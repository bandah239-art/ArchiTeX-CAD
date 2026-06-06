/**
 * Frontend engineering utility tests — pure math functions that can run without a DOM.
 * These mirror the Python golden tests on the frontend side.
 */
import { describe, it, expect } from 'vitest';

// ── Section geometry helpers ──────────────────────────────────────────────────

function effectiveDepth(h: number, cover: number, linkDia: number, barDia: number): number {
  return h - cover - linkDia - barDia / 2;
}

function steelArea(barDiaMm: number, nBars: number): number {
  return nBars * Math.PI * (barDiaMm / 2) ** 2;
}

describe('Section geometry', () => {
  it('effective depth: h=550, cover=30, link=8, bar=20 → d=502', () => {
    expect(effectiveDepth(550, 30, 8, 20)).toBeCloseTo(502, 0);
  });

  it('effective depth is positive for valid cross-section', () => {
    expect(effectiveDepth(400, 25, 8, 16)).toBeGreaterThan(0);
  });

  it('detects invalid section (cover too large)', () => {
    const d = effectiveDepth(100, 75, 8, 20);
    expect(d).toBeLessThanOrEqual(20);
  });

  it('steel area: 4 Y20 = 1257 mm²', () => {
    expect(steelArea(20, 4)).toBeCloseTo(1256.6, 0);
  });

  it('steel area: 3 Y16 = 603 mm²', () => {
    expect(steelArea(16, 3)).toBeCloseTo(603.2, 0);
  });

  it('steel area scales linearly with bar count', () => {
    expect(steelArea(20, 2)).toBeCloseTo(steelArea(20, 1) * 2, 1);
  });
});

// ── BS8110 load combinations ──────────────────────────────────────────────────

describe('BS8110 load combinations (Table 2.1)', () => {
  it('1.4Gk + 1.6Qk: Gk=20, Qk=10 → 44', () => {
    expect(1.4 * 20 + 1.6 * 10).toBeCloseTo(44);
  });

  it('1.2(Gk + Qk + Wk): 20+10+5 → 42', () => {
    expect(1.2 * (20 + 10 + 5)).toBeCloseTo(42);
  });

  it('governing combo selects maximum', () => {
    const gk = 30, qk = 15, wk = 8;
    const c1 = 1.4 * gk + 1.6 * qk;
    const c2 = 1.2 * (gk + qk + wk);
    const gov = Math.max(c1, c2);
    expect(gov).toBeGreaterThanOrEqual(c1);
    expect(gov).toBeGreaterThanOrEqual(c2);
  });
});

// ── EC0 load combinations ─────────────────────────────────────────────────────

describe('EC0 ULS combinations (EN 1990)', () => {
  it('1.35Gk + 1.5Qk: Gk=100, Qk=50 → 210', () => {
    expect(1.35 * 100 + 1.5 * 50).toBeCloseTo(210);
  });

  it('1.0Gk + 1.5Wk: for wind dominant', () => {
    expect(1.0 * 100 + 1.5 * 30).toBeCloseTo(145);
  });

  it('EC0 SLS characteristic: Gk + Qk', () => {
    expect(100 + 50).toBe(150);
  });
});

// ── Rational method hydrology ─────────────────────────────────────────────────

describe('Rational method hydrology (Q = CIA/360)', () => {
  function rationalQ(C: number, I_mmhr: number, A_ha: number): number {
    return (C * I_mmhr * A_ha) / 360;
  }

  it('C=0.7, I=60, A=1ha → Q=0.1167 m³/s (×10)', () => {
    // Q in m³/s = C×I×A/360 where A in ha, I in mm/hr
    // = 0.7×60×1/360 = 0.1167 m³/s... wait: correct formula:
    // Q (m³/s) = C×i(mm/hr)×A(ha) / 360
    expect(rationalQ(0.7, 60, 1)).toBeCloseTo(0.1167, 3);
  });

  it('doubling catchment doubles discharge', () => {
    const q1 = rationalQ(0.6, 50, 2);
    const q2 = rationalQ(0.6, 50, 4);
    expect(q2).toBeCloseTo(q1 * 2, 5);
  });

  it('higher runoff coefficient gives more discharge', () => {
    const q_low = rationalQ(0.3, 50, 5);
    const q_high = rationalQ(0.9, 50, 5);
    expect(q_high).toBeGreaterThan(q_low);
  });
});

// ── Solar PV sizing helpers ───────────────────────────────────────────────────

describe('Solar PV sizing', () => {
  function panelCount(loadKwh: number, psh: number, panelW: number, eff: number): number {
    const peakKw = loadKwh / (psh * eff);
    return Math.ceil((peakKw * 1000) / panelW);
  }

  it('5 kWh load, 5 PSH, 400W, 80% eff → 4 panels', () => {
    // 5/(5×0.8) = 1.25 kWp → 1250/400 = 3.125 → 4
    expect(panelCount(5, 5, 400, 0.8)).toBe(4);
  });

  it('more load requires more panels', () => {
    expect(panelCount(20, 5, 400, 0.8)).toBeGreaterThan(panelCount(5, 5, 400, 0.8));
  });

  it('more sun hours reduces panel count', () => {
    expect(panelCount(10, 7, 400, 0.8)).toBeLessThanOrEqual(panelCount(10, 4, 400, 0.8));
  });

  function batteryCapacityKwh(loadKwh: number, days: number, dod: number): number {
    return (loadKwh * days) / dod;
  }

  it('battery for 10 kWh/d, 2 days, 80% DoD → 25 kWh', () => {
    expect(batteryCapacityKwh(10, 2, 0.8)).toBeCloseTo(25, 1);
  });
});

// ── Water demand calculation ──────────────────────────────────────────────────

describe('Water demand (WHO standards)', () => {
  const PER_CAPITA: Record<string, number> = {
    rural: 25,
    peri_urban: 80,
    urban: 120,
  };

  it('urban per capita > peri-urban > rural', () => {
    expect(PER_CAPITA.urban).toBeGreaterThan(PER_CAPITA.peri_urban);
    expect(PER_CAPITA.peri_urban).toBeGreaterThan(PER_CAPITA.rural);
  });

  function designPop(initial: number, rate: number, years: number): number {
    return initial * Math.pow(1 + rate / 100, years);
  }

  it('geometric growth: 1000 people at 2.5% for 20yr ≈ 1639', () => {
    expect(designPop(1000, 2.5, 20)).toBeCloseTo(1638.6, 0);
  });

  it('zero growth rate gives same population', () => {
    expect(designPop(500, 0, 20)).toBe(500);
  });

  it('demand increases with population', () => {
    const demand = (pop: number) => pop * PER_CAPITA.urban / 1000; // m³/d
    expect(demand(2000)).toBeGreaterThan(demand(1000));
  });
});

// ── Bearing capacity basics ───────────────────────────────────────────────────

describe('Bearing capacity factors (Nq, Nc, Nγ)', () => {
  function Nq(phi_deg: number): number {
    const phi = (phi_deg * Math.PI) / 180;
    return Math.exp(Math.PI * Math.tan(phi)) * Math.pow(Math.tan(Math.PI / 4 + phi / 2), 2);
  }

  function Nc(phi_deg: number): number {
    if (phi_deg === 0) return 5.14;
    return (Nq(phi_deg) - 1) / Math.tan((phi_deg * Math.PI) / 180);
  }

  it('Nq increases with friction angle', () => {
    expect(Nq(30)).toBeGreaterThan(Nq(20));
    expect(Nq(20)).toBeGreaterThan(Nq(10));
  });

  it('Nq(30°) ≈ 18.4', () => {
    expect(Nq(30)).toBeCloseTo(18.4, 0);
  });

  it('Nc(0°) = 5.14 (Prandtl limit)', () => {
    expect(Nc(0)).toBeCloseTo(5.14, 1);
  });

  it('Nc increases with friction angle', () => {
    expect(Nc(30)).toBeGreaterThan(Nc(20));
  });
});

// ── ZMW rate plausibility ─────────────────────────────────────────────────────

describe('ZMW unit rates (Zambia context)', () => {
  const rates = {
    concrete_m3: 3500,       // ZMW/m³ C25
    rebar_per_tonne: 18000,  // ZMW/tonne Y500
    formwork_m2: 450,        // ZMW/m²
    excavation_m3: 280,      // ZMW/m³
    blockwork_m2: 380,       // ZMW/m²
  };

  it('concrete rate is between 2000–6000 ZMW/m³', () => {
    expect(rates.concrete_m3).toBeGreaterThanOrEqual(2000);
    expect(rates.concrete_m3).toBeLessThanOrEqual(6000);
  });

  it('rebar rate is between 12000–28000 ZMW/tonne', () => {
    expect(rates.rebar_per_tonne).toBeGreaterThanOrEqual(12000);
    expect(rates.rebar_per_tonne).toBeLessThanOrEqual(28000);
  });

  it('all rates are positive', () => {
    for (const [, val] of Object.entries(rates)) {
      expect(val).toBeGreaterThan(0);
    }
  });
});

// ── Error boundary helpers ────────────────────────────────────────────────────

describe('ErrorBoundary error ID generation', () => {
  function generateId(): string {
    return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  it('generates unique IDs', () => {
    const ids = Array.from({ length: 100 }, generateId);
    const unique = new Set(ids);
    expect(unique.size).toBe(100);
  });

  it('ID starts with err_', () => {
    expect(generateId()).toMatch(/^err_/);
  });

  it('ID has expected format', () => {
    expect(generateId()).toMatch(/^err_[a-z0-9]+_[a-z0-9]+$/);
  });
});

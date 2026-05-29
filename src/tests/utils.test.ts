import { describe, it, expect } from 'vitest';

// Load combinations — BS 8110 Table 2.1
describe('BS 8110 load combinations', () => {
  it('combo 1: 1.4Gk + 1.6Qk', () => {
    const gk = 20, qk = 10;
    expect(1.4 * gk + 1.6 * qk).toBeCloseTo(44.0);
  });

  it('combo 2: 1.2(Gk + Qk + Wk)', () => {
    const gk = 20, qk = 10, wk = 5;
    expect(1.2 * (gk + qk + wk)).toBeCloseTo(42.0);
  });
});

// Effective depth guard expectation
describe('section geometry', () => {
  it('effective depth is positive for valid inputs', () => {
    const h = 500, cover = 30, linkDia = 8, barDia = 16;
    const d = h - cover - linkDia - barDia / 2;
    expect(d).toBeGreaterThan(20);
  });

  it('detects cover exceeding depth', () => {
    const h = 100, cover = 75, linkDia = 8, barDia = 20;
    const d = h - cover - linkDia - barDia / 2;
    expect(d).toBeLessThanOrEqual(20);
  });
});

// ZMW rate plausibility (Zambia engineering context)
describe('ZMW rate plausibility', () => {
  it('cement bag cost is in ZMW range', () => {
    const cementPerBag = 200; // ZMW/50kg bag
    expect(cementPerBag).toBeGreaterThan(150);
    expect(cementPerBag).toBeLessThan(300);
  });
});

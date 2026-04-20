// v6.0-F-NANSRADAR Gelistirme
import { describe, it, expect } from 'vitest';
import { predictWeekly, estimateJumpParams } from '../src/services/prediction.js';

const mockPrices = Array.from({ length: 100 }, (_, i) => ({
  date: new Date(2024, 0, i + 1),
  close: 100 + Math.sin(i * 0.1) * 10 + i * 0.1,
  volume: 1000000 + Math.random() * 500000
}));

describe('Monte Carlo Simulasyonu', () => {
  it('Tahmin uretmeli', () => {
    const result = predictWeekly(mockPrices, 7);
    expect(result.target).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('Guven araligi mantikli olmali', () => {
    const result = predictWeekly(mockPrices, 7);
    expect(result.range.lower5).toBeLessThan(result.range.median);
    expect(result.range.median).toBeLessThan(result.range.upper95);
  });

  it('Jump parametreleri hesaplanmali', () => {
    const returns = mockPrices.slice(1).map((p, i) => Math.log(p.close / mockPrices[i].close));
    const jumps = estimateJumpParams(returns);
    expect(jumps.jumpIntensity).toBeGreaterThanOrEqual(0);
    expect(jumps.jumpIntensity).toBeLessThanOrEqual(1);
  });

  it('P25-P75 araligi dar olmali', () => {
    const result = predictWeekly(mockPrices, 7);
    expect(result.range.upper75 - result.range.lower25).toBeLessThan(result.range.upper95 - result.range.lower5);
  });
});

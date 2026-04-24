// v6.0-F-NANSRADAR Gelistirme
import { describe, it, expect } from 'vitest';
import { GARCHModel, EGARCHModel, archTest } from '../src/services/volatilityModel.js';

describe('GARCH Modelleri', () => {
  const returns = Array.from({ length: 252 }, () => (Math.random() - 0.5) * 0.02);

  it('GARCH(1,1) fit etmeli', () => {
    const model = new GARCHModel();
    const params = model.fit(returns);
    expect(params.alpha + params.beta).toBeLessThan(1);
    expect(params.omega).toBeGreaterThan(0);
  });

  it('Volatilite forecast uretmeli', () => {
    const model = new GARCHModel();
    model.fit(returns);
    const forecasts = model.forecast(returns, 30);
    expect(forecasts.length).toBe(30);
    expect(forecasts.every(v => v > 0)).toBe(true);
  });

  it('EGARCH fit etmeli', () => {
    const model = new EGARCHModel();
    model.fit(returns);
    expect(model.beta).toBeGreaterThan(0);
  });

  it('ARCH test calismali', () => {
    const result = archTest(returns);
    expect(result.lmStatistic).toBeGreaterThan(0);
    expect(result.pValue).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeLessThanOrEqual(1);
  });
});

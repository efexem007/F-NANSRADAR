// v6.0-F-NANSRADAR Gelistirme

import { GARCHModel } from './volatilityModel.js';
import { calculateAdaptiveDrift } from './driftModel.js';

const HORIZONS = {
  '1G':  { days: 1,   label: '1 Gün',    tradingDays: 1 },
  '3G':  { days: 3,   label: '3 Gün',    tradingDays: 3 },
  '5G':  { days: 5,   label: '1 Hafta',  tradingDays: 5 },
  '10G': { days: 10,  label: '2 Hafta',  tradingDays: 10 },
  '1A':  { days: 21,  label: '1 Ay',     tradingDays: 21 },
  '3A':  { days: 63,  label: '3 Ay',     tradingDays: 63 },
  '6A':  { days: 126, label: '6 Ay',     tradingDays: 126 },
  '1Y':  { days: 252, label: '1 Yıl',    tradingDays: 252 }
};

function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function estimateJumpParams(returns) {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length);
  const threshold = 2.5 * std;
  const jumps = returns.filter(r => Math.abs(r - mean) > threshold);
  return {
    jumpIntensity: jumps.length / returns.length,
    jumpMean: jumps.length > 0 ? jumps.reduce((a, b) => a + b, 0) / jumps.length : 0,
    jumpStd: jumps.length > 1
      ? Math.sqrt(jumps.reduce((a, b) => a + b ** 2, 0) / jumps.length)
      : std * 0.5
  };
}

function detectVolatilityRegime(returns) {
  const recentVol = Math.sqrt(
    returns.slice(-20).reduce((a, b) => a + b ** 2, 0) / 20
  ) * Math.sqrt(252);
  const longVol = Math.sqrt(
    returns.reduce((a, b) => a + b ** 2, 0) / returns.length
  ) * Math.sqrt(252);

  const ratio = recentVol / longVol;
  return {
    recentVolatility: parseFloat((recentVol * 100).toFixed(2)),
    historicalVolatility: parseFloat((longVol * 100).toFixed(2)),
    regime: ratio > 1.5 ? 'YÜKSEK' : ratio < 0.7 ? 'DÜŞÜK' : 'NORMAL',
    ratio: parseFloat(ratio.toFixed(2))
  };
}

function runMonteCarlo(S0, mu, sigmaBase, days, nSim, jumpParams, garchForecasts) {
  const paths = [];
  const dt = 1 / 252;

  for (let s = 0; s < nSim; s += 2) {
    // Antitetik varyans azaltma
    let price1 = S0, price2 = S0;
    const path1 = [price1], path2 = [price2];

    for (let d = 0; d < days; d++) {
      const sigma = garchForecasts ? garchForecasts[Math.min(d, garchForecasts.length - 1)] : sigmaBase;
      const z = randn();

      for (const [path, sign] of [[path1, 1], [path2, -1]]) {
        const dW = sign * z * Math.sqrt(dt);
        const drift = (mu - 0.5 * sigma ** 2) * dt;
        const diffusion = sigma * dW;
        const jumpOccur = Math.random() < jumpParams.jumpIntensity * dt;
        const jump = jumpOccur ? jumpParams.jumpMean + jumpParams.jumpStd * randn() : 0;
        const last = path[path.length - 1];
        path.push(Math.max(last * Math.exp(drift + diffusion + jump), 0.0001));
      }
    }
    paths.push(path1, path2);
  }
  return paths;
}

function calcPercentiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const pct = (p) => sorted[Math.floor(n * p / 100)];
  return {
    p5:  parseFloat(pct(5).toFixed(4)),
    p10: parseFloat(pct(10).toFixed(4)),
    p25: parseFloat(pct(25).toFixed(4)),
    p50: parseFloat(pct(50).toFixed(4)),
    p75: parseFloat(pct(75).toFixed(4)),
    p90: parseFloat(pct(90).toFixed(4)),
    p95: parseFloat(pct(95).toFixed(4)),
    mean: parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4))
  };
}

function calcMaxDrawdown(path) {
  let peak = path[0], maxDD = 0;
  for (const p of path) {
    if (p > peak) peak = p;
    const dd = (peak - p) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

export async function predictAllHorizons(priceData, options = {}) {
  const { simulations = 10000 } = options;

  const closes = priceData.map(p => p.close);
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }

  const S0 = closes[closes.length - 1];
  const mu = returns.reduce((a, b) => a + b, 0) / returns.length;
  const sigma = Math.sqrt(returns.reduce((a, b) => a + (b - mu) ** 2, 0) / returns.length);
  const jumpParams = estimateJumpParams(returns);
  const volRegime = detectVolatilityRegime(returns);
  const driftInfo = calculateAdaptiveDrift(returns);

  // GARCH volatilite tahmini
  let garchForecasts = null;
  try {
    const garch = new GARCHModel();
    garch.fit(returns);
    garchForecasts = garch.forecast(returns, 252);
  } catch (e) {
    console.warn('GARCH başarısız, sabit volatilite kullanılıyor');
  }

  const results = {};

  for (const [key, horizon] of Object.entries(HORIZONS)) {
    const paths = runMonteCarlo(
      S0, mu, sigma, horizon.tradingDays, simulations,
      jumpParams, garchForecasts
    );

    const finalPrices = paths.map(p => p[p.length - 1]);
    const pctiles = calcPercentiles(finalPrices);
    const returns_ = finalPrices.map(p => (p - S0) / S0 * 100);
    const returnPctiles = calcPercentiles(returns_);

    // Drawdown analizi
    const drawdowns = paths.map(p => calcMaxDrawdown(p) * 100);
    const avgDrawdown = drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;

    // Olasılık hesapları
    const probUp = finalPrices.filter(p => p > S0).length / finalPrices.length * 100;
    const probUp5 = finalPrices.filter(p => p > S0 * 1.05).length / finalPrices.length * 100;
    const probDown5 = finalPrices.filter(p => p < S0 * 0.95).length / finalPrices.length * 100;

    results[key] = {
      horizon: horizon.label,
      days: horizon.tradingDays,
      currentPrice: S0,
      forecast: {
        price: pctiles,
        returnPct: returnPctiles
      },
      probabilities: {
        up: parseFloat(probUp.toFixed(1)),
        up5pct: parseFloat(probUp5.toFixed(1)),
        down5pct: parseFloat(probDown5.toFixed(1))
      },
      risk: {
        avgMaxDrawdown: parseFloat(avgDrawdown.toFixed(2)),
        volatilityAnnualized: parseFloat((sigma * Math.sqrt(252) * 100).toFixed(2))
      },
      signal: returnPctiles.p50 > 2 ? 'AL' :
              returnPctiles.p50 < -2 ? 'SAT' : 'BEKLE',
      confidence: parseFloat(
        (100 - (pctiles.p95 - pctiles.p5) / S0 * 100 / 2).toFixed(1)
      )
    };
  }

  return {
    symbol: priceData[0]?.symbol,
    currentPrice: S0,
    analysisDate: new Date().toISOString(),
    volatilityRegime: volRegime,
    drift: driftInfo,
    jumpRisk: {
      intensity: parseFloat((jumpParams.jumpIntensity * 100).toFixed(2)),
      avgJumpSize: parseFloat((jumpParams.jumpMean * 100).toFixed(2))
    },
    horizons: results,
    simulations
  };
}

export async function predictSingleHorizon(priceData, horizonKey = '1A', simulations = 10000) {
  const all = await predictAllHorizons(priceData, { simulations });
  return {
    ...all,
    horizon: all.horizons[horizonKey]
  };
}

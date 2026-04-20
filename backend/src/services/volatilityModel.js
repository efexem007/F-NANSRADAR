// v6.0-F-NANSRADAR Gelistirme

export class GARCHModel {
  constructor(omega = 0.000001, alpha = 0.1, beta = 0.85) {
    this.omega = omega;
    this.alpha = alpha;
    this.beta = beta;
    this.variance = null;
  }

  fit(returns) {
    // Grid search ile en iyi parametreleri bul
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const squaredReturns = returns.map(r => (r - mean) ** 2);
    this.variance = squaredReturns.reduce((a, b) => a + b, 0) / squaredReturns.length;

    let bestLikelihood = -Infinity;
    const wParams = [0.000001, 0.00001, 0.0001, 0.001];

    for (const w of wParams) {
      for (const a of [0.05, 0.1, 0.15, 0.2]) {
        for (const b of [0.7, 0.8, 0.85, 0.9]) {
          if (a + b >= 1) continue;
          const ll = this.calculateLikelihood(squaredReturns, w, a, b);
          if (ll > bestLikelihood) {
            bestLikelihood = ll;
            this.omega = w;
            this.alpha = a;
            this.beta = b;
          }
        }
      }
    }
    return { omega: this.omega, alpha: this.alpha, beta: this.beta };
  }

  calculateLikelihood(sqReturns, omega, alpha, beta) {
    let variance = sqReturns[0];
    let likelihood = 0;
    for (let i = 1; i < sqReturns.length; i++) {
      variance = omega + alpha * sqReturns[i - 1] + beta * variance;
      likelihood -= Math.log(variance) + sqReturns[i] / variance;
    }
    return likelihood;
  }

  forecast(returns, stepsAhead = 30) {
    if (!this.variance) this.fit(returns);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const sqReturns = returns.map(r => (r - mean) ** 2);
    let currentVar = this.variance;

    for (let i = 1; i < sqReturns.length; i++) {
      currentVar = this.omega + this.alpha * sqReturns[i - 1] + this.beta * currentVar;
    }

    const forecasts = [];
    for (let i = 0; i < stepsAhead; i++) {
      currentVar = this.omega + (this.alpha + this.beta) * currentVar;
      forecasts.push(Math.sqrt(currentVar));
    }
    return forecasts;
  }
}

export class EGARCHModel {
  constructor(omega = -0.1, alpha = 0.1, gamma = -0.05, beta = 0.95) {
    this.omega = omega;
    this.alpha = alpha;
    this.gamma = gamma;
    this.beta = beta;
  }

  fit(returns) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const standardized = returns.map(r => r - mean);
    let bestLikelihood = -Infinity;

    for (const w of [-0.5, -0.1, -0.01]) {
      for (const a of [0.05, 0.1, 0.15]) {
        for (const g of [-0.1, -0.05, 0, 0.05]) {
          for (const b of [0.85, 0.9, 0.95, 0.98]) {
            const ll = this.logLikelihood(standardized, w, a, g, b);
            if (ll > bestLikelihood) {
              bestLikelihood = ll;
              this.omega = w;
              this.alpha = a;
              this.gamma = g;
              this.beta = b;
            }
          }
        }
      }
    }
  }

  logLikelihood(returns, w, a, g, b) {
    let logVar = Math.log(returns[0] ** 2 + 1e-10);
    let ll = 0;
    for (let i = 1; i < returns.length; i++) {
      const z = returns[i - 1] / Math.sqrt(Math.exp(logVar));
      logVar = w + a * Math.abs(z) + g * z + b * logVar;
      ll -= 0.5 * (logVar + returns[i] ** 2 / Math.exp(logVar));
    }
    return ll;
  }

  forecast(returns, steps) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    let logVar = Math.log((returns[returns.length - 1] - mean) ** 2 + 1e-10);
    const forecasts = [];
    for (let i = 0; i < steps; i++) {
      logVar = this.omega + this.beta * logVar;
      forecasts.push(Math.sqrt(Math.exp(logVar)));
    }
    return forecasts;
  }
}

export function archTest(returns, lags = 5) {
  const squaredReturns = returns.map(r => r * r);
  const n = squaredReturns.length;
  const meanSq = squaredReturns.reduce((a, b) => a + b, 0) / n;
  let lm = 0;

  for (let lag = 1; lag <= lags; lag++) {
    let numerator = 0;
    let denominator = 0;
    for (let t = lag; t < n; t++) {
      numerator += (squaredReturns[t] - meanSq) * (squaredReturns[t - lag] - meanSq);
      denominator += (squaredReturns[t] - meanSq) ** 2;
    }
    const autocorr = numerator / denominator;
    lm += autocorr * autocorr * (n - lag);
  }

  // Basit chi-square CDF yaklaşımı
  const pValue = Math.exp(-lm / (2 * lags));
  return {
    lmStatistic: parseFloat(lm.toFixed(4)),
    pValue: parseFloat(pValue.toFixed(4)),
    hasArch: pValue < 0.05
  };
}

export function selectBestGARCH(returns) {
  const models = [
    { name: 'GARCH(1,1)', Model: GARCHModel, params: {} },
    { name: 'EGARCH(1,1)', Model: EGARCHModel, params: {} }
  ];

  let bestAIC = Infinity;
  let bestModel = null;

  for (const { name, Model } of models) {
    const model = new Model();
    model.fit(returns);
    const logLikelihood = model.calculateLikelihood(
      returns.map(r => r * r),
      model.omega, model.alpha, model.beta
    );
    const n = returns.length;
    const k = 3;
    const aic = -2 * logLikelihood + 2 * k;
    if (aic < bestAIC) {
      bestAIC = aic;
      bestModel = { name, model, aic };
    }
  }
  return bestModel;
}

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

// v6.0-F-NANSRADAR Gelistirme - Regime-Switching GARCH
export class RSGARCHModel {
  constructor() {
    this.regimes = {
      low: { omega: 0.000001, alpha: 0.05, beta: 0.93 },
      high: { omega: 0.0001, alpha: 0.15, beta: 0.80 }
    };
    this.currentRegime = 'low';
    this.transitionMatrix = [[0.95, 0.05], [0.10, 0.90]]; // [low->low, low->high], [high->low, high->high]
    this.regimeProbabilities = [0.7, 0.3]; // Başlangıç olasılıkları
    this.variances = [];
    this.regimeHistory = [];
  }

  /**
   * Regime detection via volatility clustering
   */
  fit(returns) {
    if (!returns || returns.length < 50) {
      throw new Error('En az 50 veri noktası gereklidir');
    }

    const squaredReturns = returns.map(r => r * r);
    const rollingWindow = 20;
    const rollingVol = [];

    // Rolling volatility hesapla
    for (let i = rollingWindow - 1; i < squaredReturns.length; i++) {
      const window = squaredReturns.slice(i - rollingWindow + 1, i + 1);
      const vol = Math.sqrt(window.reduce((a, b) => a + b, 0) / window.length);
      rollingVol.push(vol);
    }

    // Volatility threshold (75th percentile)
    const sortedVol = [...rollingVol].sort((a, b) => a - b);
    const threshold = sortedVol[Math.floor(sortedVol.length * 0.75)];

    // Regime classification
    this.regimeHistory = [];
    for (let i = 0; i < rollingVol.length; i++) {
      const regime = rollingVol[i] > threshold ? 'high' : 'low';
      this.regimeHistory.push(regime);
    }

    // Regime-specific parameter estimation
    this.estimateRegimeParameters(returns, rollingVol, threshold);
    
    // Markov transition probabilities
    this.estimateTransitionProbabilities();

    return {
      regimes: this.regimes,
      transitionMatrix: this.transitionMatrix,
      regimeHistory: this.regimeHistory,
      threshold: threshold
    };
  }

  estimateRegimeParameters(returns, rollingVol, threshold) {
    const lowReturns = [];
    const highReturns = [];
    
    for (let i = 0; i < returns.length; i++) {
      if (i < 19) continue; // İlk 20 gün rolling vol yok
      const regime = rollingVol[i - 19] > threshold ? 'high' : 'low';
      
      if (regime === 'low') {
        lowReturns.push(returns[i]);
      } else {
        highReturns.push(returns[i]);
      }
    }

    // Low regime parameters
    if (lowReturns.length > 20) {
      const lowSquared = lowReturns.map(r => r * r);
      const lowMeanSq = lowSquared.reduce((a, b) => a + b, 0) / lowSquared.length;
      
      // Simple GARCH(1,1) estimation for low regime
      this.regimes.low.omega = lowMeanSq * 0.1;
      this.regimes.low.alpha = 0.05;
      this.regimes.low.beta = 0.93;
    }

    // High regime parameters
    if (highReturns.length > 20) {
      const highSquared = highReturns.map(r => r * r);
      const highMeanSq = highSquared.reduce((a, b) => a + b, 0) / highSquared.length;
      
      this.regimes.high.omega = highMeanSq * 0.2;
      this.regimes.high.alpha = 0.15;
      this.regimes.high.beta = 0.80;
    }
  }

  estimateTransitionProbabilities() {
    if (this.regimeHistory.length < 2) return;
    
    let lowToLow = 0, lowToHigh = 0, highToLow = 0, highToHigh = 0;
    
    for (let i = 1; i < this.regimeHistory.length; i++) {
      const prev = this.regimeHistory[i - 1];
      const curr = this.regimeHistory[i];
      
      if (prev === 'low' && curr === 'low') lowToLow++;
      if (prev === 'low' && curr === 'high') lowToHigh++;
      if (prev === 'high' && curr === 'low') highToLow++;
      if (prev === 'high' && curr === 'high') highToHigh++;
    }
    
    const totalLow = lowToLow + lowToHigh;
    const totalHigh = highToLow + highToHigh;
    
    if (totalLow > 0) {
      this.transitionMatrix[0][0] = lowToLow / totalLow;
      this.transitionMatrix[0][1] = lowToHigh / totalLow;
    }
    
    if (totalHigh > 0) {
      this.transitionMatrix[1][0] = highToLow / totalHigh;
      this.transitionMatrix[1][1] = highToHigh / totalHigh;
    }
  }

  forecast(returns, stepsAhead = 30) {
    if (this.regimeHistory.length === 0) {
      this.fit(returns);
    }
    
    const forecasts = [];
    let currentRegime = this.regimeHistory[this.regimeHistory.length - 1] || 'low';
    let currentVariance = this.calculateCurrentVariance(returns);
    
    for (let i = 0; i < stepsAhead; i++) {
      // Regime transition
      const rand = Math.random();
      const transitionProbs = currentRegime === 'low' 
        ? this.transitionMatrix[0] 
        : this.transitionMatrix[1];
      
      currentRegime = rand < transitionProbs[0] ? currentRegime : 
                     (currentRegime === 'low' ? 'high' : 'low');
      
      // GARCH forecast with regime-specific parameters
      const params = this.regimes[currentRegime];
      currentVariance = params.omega + (params.alpha + params.beta) * currentVariance;
      
      forecasts.push(Math.sqrt(currentVariance));
    }
    
    return forecasts;
  }

  calculateCurrentVariance(returns) {
    if (returns.length === 0) return 0.0001;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const squaredDeviations = returns.map(r => (r - mean) ** 2);
    return squaredDeviations.reduce((a, b) => a + b, 0) / squaredDeviations.length;
  }

  /**
   * Regime probability at a specific step
   */
  getRegimeProbability(stepsAhead = 1) {
    if (this.regimeHistory.length === 0) {
      return { low: 0.7, high: 0.3 };
    }
    
    let currentProb = [0, 0];
    const lastRegime = this.regimeHistory[this.regimeHistory.length - 1];
    currentProb[lastRegime === 'low' ? 0 : 1] = 1;
    
    for (let i = 0; i < stepsAhead; i++) {
      const newProb = [0, 0];
      newProb[0] = currentProb[0] * this.transitionMatrix[0][0] + 
                   currentProb[1] * this.transitionMatrix[1][0];
      newProb[1] = currentProb[0] * this.transitionMatrix[0][1] + 
                   currentProb[1] * this.transitionMatrix[1][1];
      currentProb = newProb;
    }
    
    return { low: currentProb[0], high: currentProb[1] };
  }
}

// Historical Bootstrap Simulation
export function simulateHistoricalBootstrap(returns, daysAhead, nSimulations = 50000) {
  if (!returns || returns.length < 100) {
    throw new Error('En az 100 geçmiş getiri verisi gereklidir');
  }
  
  const currentReturn = returns[returns.length - 1];
  const allPaths = [];
  
  for (let s = 0; s < nSimulations; s++) {
    const path = [currentReturn];
    
    for (let d = 0; d < daysAhead; d++) {
      // Random historical return selection (with replacement)
      const randomIndex = Math.floor(Math.random() * returns.length);
      const historicalReturn = returns[randomIndex];
      
      // Cumulate returns
      const newReturn = path[path.length - 1] + historicalReturn;
      path.push(newReturn);
    }
    
    allPaths.push(path);
  }
  
  return allPaths;
}

export function selectBestGARCH(returns) {
  const models = [
    { name: 'GARCH(1,1)', Model: GARCHModel, params: {} },
    { name: 'EGARCH(1,1)', Model: EGARCHModel, params: {} },
    { name: 'RS-GARCH', Model: RSGARCHModel, params: {} }
  ];

  let bestAIC = Infinity;
  let bestModel = null;

  for (const { name, Model } of models) {
    try {
      const model = new Model();
      model.fit(returns);
      
      let logLikelihood;
      if (name === 'RS-GARCH') {
        // Simplified likelihood for RS-GARCH
        const variances = model.forecast(returns, 1);
        const meanSq = returns.map(r => r * r).reduce((a, b) => a + b, 0) / returns.length;
        logLikelihood = -returns.length * Math.log(2 * Math.PI * meanSq) / 2 - 
                        returns.reduce((sum, r) => sum + (r * r) / (2 * meanSq), 0);
      } else {
        logLikelihood = model.calculateLikelihood(
          returns.map(r => r * r),
          model.omega, model.alpha, model.beta
        );
      }
      
      const n = returns.length;
      const k = name === 'RS-GARCH' ? 6 : 3; // RS-GARCH has more parameters
      const aic = -2 * logLikelihood + 2 * k;
      
      if (aic < bestAIC) {
        bestAIC = aic;
        bestModel = { name, model, aic };
      }
    } catch (error) {
      console.warn(`${name} model fitting failed:`, error.message);
    }
  }
  return bestModel;
}

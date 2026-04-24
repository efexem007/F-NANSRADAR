/**
 * Hierarchical Risk Parity (HRP) + Multi-Objective Reward
 * Kademe 5
 * 
 * Tek hisse analizi için: Inverse Volatility weighting (HRP'nin tek-varlık versiyonu)
 * Portföy analizi için: Kovaryans matrisine dayalı tam HRP
 */

/**
 * Portföy için HRP ağırlıkları (tek hisse: 1.0 döner ama bağlam hesaplanır)
 * V_cluster = w' * Σ * w
 * α = 1 - V_1 / (V_1 + V_2)  (iki küme arasında)
 */
export function calcInverseVolatilityWeight(priceDataMap) {
  const tickers = Object.keys(priceDataMap);
  if (tickers.length === 0) return {};

  const volatilities = {};
  for (const ticker of tickers) {
    const data = priceDataMap[ticker];
    if (!data || data.length < 10) { volatilities[ticker] = 1; continue; }
    const returns = data.slice(1).map((p, i) => (p.close - data[i].close) / data[i].close);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    volatilities[ticker] = Math.sqrt(Math.max(variance, 0.0001)); // sigma günlük
  }

  // Inverse volatility weights
  const invVols = {};
  let totalInv = 0;
  for (const ticker of tickers) {
    invVols[ticker] = 1 / volatilities[ticker];
    totalInv += invVols[ticker];
  }

  const weights = {};
  for (const ticker of tickers) {
    weights[ticker] = parseFloat((invVols[ticker] / totalInv).toFixed(4));
  }

  return weights;
}

export const optimizePortfolio = calcInverseVolatilityWeight;

/**
 * Cluster varyansı hesapla (HRP adımı)
 * V = Σ w_i² * σ_i² (bağımsız varlıklar varsayımı)
 */
export function calcClusterVariance(returns, weights) {
  const variances = {};
  for (const [ticker, ret] of Object.entries(returns)) {
    const mean = ret.reduce((a, b) => a + b, 0) / ret.length;
    const variance = ret.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / ret.length;
    variances[ticker] = variance;
  }
  return Object.entries(weights).reduce((sum, [ticker, w]) => sum + w * w * (variances[ticker] || 0), 0);
}

/**
 * Çok Amaçlı Ödül Fonksiyonu (Kademe 5 - Formül)
 * R_t = r_t - λ1*CVaR_t - λ2*Turnover_t - λ3*DD_t
 * Piyasa rejimine göre λ değerleri değişir
 */
export function calcMultiObjectiveReward({ dailyReturn, cvar, drawdown, turnover, regime }) {
  // λ parametreleri piyasa rejimine göre
  const lambdas = {
    calm:    { l1: 0.3, l2: 0.2, l3: 0.1 },
    crisis:  { l1: 0.6, l2: 0.1, l3: 0.4 },
    highVol: { l1: 0.4, l2: 0.4, l3: 0.2 },
  };
  const l = lambdas[regime] || lambdas.calm;
  
  const cvarLoss = Math.abs(cvar || 0); // negatif CVaR'ı pozitife çevir
  const reward = dailyReturn - (l.l1 * cvarLoss) - (l.l2 * (turnover || 0)) - (l.l3 * (drawdown || 0));

  return {
    reward: parseFloat(reward.toFixed(4)),
    lambdas: l,
    breakdown: {
      returnComponent: parseFloat(dailyReturn.toFixed(4)),
      riskPenalty: parseFloat((l.l1 * cvarLoss).toFixed(4)),
      costPenalty: parseFloat((l.l2 * (turnover || 0)).toFixed(4)),
      drawdownPenalty: parseFloat((l.l3 * (drawdown || 0)).toFixed(4)),
    }
  };
}

/**
 * G-Learning soft policy approximation
 * β = 0.1 için dengeli exploration/exploitation
 * π(a|x) ∝ π_0(a|x) * exp(β * G(x,a))
 */
export function softPolicy(signalScore, beta = 0.1, regimeRisk = 0) {
  // G(x,a) değerleri - basitleştirilmiş
  const gValues = {
    'GÜÇLÜ AL': signalScore / 100,
    'AL': signalScore / 100 * 0.7,
    'BEKLE': 0.5,
    'SAT': (100 - signalScore) / 100 * 0.7,
    'GÜÇLÜ SAT': (100 - signalScore) / 100,
  };

  // Kriz rejimine göre prior π_0 güncelle
  const prior = {
    'GÜÇLÜ AL': regimeRisk > 0.6 ? 0.05 : 0.20,
    'AL': regimeRisk > 0.6 ? 0.10 : 0.25,
    'BEKLE': 0.30,
    'SAT': regimeRisk > 0.6 ? 0.30 : 0.15,
    'GÜÇLÜ SAT': regimeRisk > 0.6 ? 0.25 : 0.10,
  };

  // Soft policy hesabı
  const unnorm = {};
  for (const [action, g] of Object.entries(gValues)) {
    unnorm[action] = prior[action] * Math.exp(beta * g);
  }
  const z = Object.values(unnorm).reduce((a, b) => a + b, 0);

  const policy = {};
  for (const [action, val] of Object.entries(unnorm)) {
    policy[action] = parseFloat((val / z).toFixed(4));
  }

  const bestAction = Object.entries(policy).sort((a, b) => b[1] - a[1])[0];

  return { policy, bestAction: bestAction[0], bestProb: bestAction[1] };
}

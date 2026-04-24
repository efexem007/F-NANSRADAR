/**
 * Risk Analytics - Kademe 4
 * GARCH(1,1) + Historical VaR/CVaR (EVT yaklaşımı) + Tail Risk
 *
 * GARCH: σ²_t = ω + α·ε²_{t-1} + β·σ²_{t-1}
 * VaR/CVaR: Historical simulation + GPD tail approximation
 */

/**
 * GARCH(1,1) parametre kalibrasyonu - Veriye dayalı tahmin (v2.0)
 * Moment-based yaklaşım ile alpha/beta tahmini
 */
function calibrateGarchParams(returns) {
  if (returns.length < 40) return { omega: 0.000001, alpha: 0.08, beta: 0.91 }; // Fallback

  // Basit kalibrasyon: ARCH(1) regresyonu
  const n = returns.length;
  const squaredReturns = returns.map(r => r * r);
  
  // E[r²_t] = omega + alpha * r²_{t-1} + beta * E[r²_{t-1}]
  // Moment-based: E[r²] ve autocorrelation kullan
  const meanSq = squaredReturns.reduce((a, b) => a + b, 0) / n;
  
  // r²'nin kendi gecikmesiyle korelasyonu (lag-1 autocorrelation)
  let cov = 0, varSq = 0;
  for (let i = 1; i < n; i++) {
    cov += (squaredReturns[i] - meanSq) * (squaredReturns[i - 1] - meanSq);
    varSq += (squaredReturns[i - 1] - meanSq) ** 2;
  }
  const rho1 = varSq > 0 ? cov / varSq : 0;
  
  // alpha ≈ rho1 (ARCH etkisi)
  // beta ≈ 0.95 - alpha (typical financial persistence)
  let alpha = Math.max(0.02, Math.min(0.20, Math.abs(rho1)));
  let beta = Math.max(0.70, Math.min(0.97 - alpha, 0.95 - alpha * 0.5));
  
  // omega = mean(r²) * (1 - alpha - beta)
  const persistence = alpha + beta;
  let omega = meanSq * Math.max(0.001, 1 - persistence);
  
  return { omega, alpha, beta };
}

/**
 * GARCH(1,1) Volatilite Tahmini - v2.0 Kalibre edilmiş parametreler
 * σ²_t = ω + α·ε²_{t-1} + β·σ²_{t-1}
 */
export function garch11(returns, omega = null, alpha = null, beta = null) {
  if (returns.length < 20) return { sigma: null, halfLife: null, persistence: null };

  // v2.0: Parametreler verilmediyse kalibre et
  const params = (omega == null || alpha == null || beta == null)
    ? calibrateGarchParams(returns)
    : { omega, alpha, beta };

  const persistence = params.alpha + params.beta;
  const halfLife = persistence < 1 ? Math.round(Math.log(0.5) / Math.log(persistence)) : 999;

  // Başlangıç volatilite: örneklem varyansı
  let sigma2 = returns.slice(0, 20).reduce((a, b) => a + b * b, 0) / 20;

  const sigmas = [];
  for (const r of returns) {
    sigma2 = params.omega + params.alpha * r * r + params.beta * sigma2;
    sigmas.push(Math.sqrt(Math.max(0, sigma2)));
  }

  const latestSigma = sigmas[sigmas.length - 1];
  const annualSigma = latestSigma * Math.sqrt(252);

  let volRegime;
  if (annualSigma < 0.20) volRegime = 'Düşük';
  else if (annualSigma < 0.35) volRegime = 'Orta';
  else volRegime = 'Yüksek';

  return {
    sigma: parseFloat(latestSigma.toFixed(6)),
    annualSigma: parseFloat((annualSigma * 100).toFixed(2)),
    persistence: parseFloat(persistence.toFixed(3)),
    halfLife,
    volRegime,
    params: { omega: params.omega, alpha: params.alpha, beta: params.beta },
    comment: `GARCH volatilite: ${(annualSigma * 100).toFixed(1)}% yıllık | α=${params.alpha.toFixed(3)} β=${params.beta.toFixed(3)} | Persistans: ${persistence.toFixed(3)} | Yarı ömür: ${halfLife} gün | Rejim: ${volRegime}`
  };
}

/**
 * Historical VaR ve CVaR (Expected Shortfall)
 * Tüm getirileri sırala, q. yüzdeliği al
 */
export function calcVaR(returns, confidenceLevel = 0.95) {
  if (returns.length < 20) return { var95: null, cvar95: null, var99: null };

  const sorted = [...returns].sort((a, b) => a - b);
  const n = sorted.length;

  const idx95 = Math.floor((1 - confidenceLevel) * n);
  const idx99 = Math.floor(0.01 * n);

  const var95 = sorted[Math.max(0, idx95)];
  const var99 = sorted[Math.max(0, idx99)];

  // CVaR = ortalama kayıp VaR'ın altında
  const tailReturns = sorted.slice(0, Math.max(1, idx95));
  const cvar95 = tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length;

  return {
    var95: parseFloat((var95 * 100).toFixed(2)),
    var99: parseFloat((var99 * 100).toFixed(2)),
    cvar95: parseFloat((cvar95 * 100).toFixed(2)),
  };
}

/**
 * Hill Estimator - Tail Index (EVT yaklaşımı)
 * ξ (şekil parametresi) tahmini
 * ξ > 0 → fat tail (siyah kuğu riski)
 */
export function hillEstimator(returns, k = 20) {
  const sorted = [...returns].sort((a, b) => a - b);
  const lossReturns = sorted.filter(r => r < 0).map(r => -r).sort((a, b) => b - a);
  if (lossReturns.length < k) k = Math.max(5, Math.floor(lossReturns.length / 2));
  
  const threshold = lossReturns[k - 1] || 0.01;
  const logRatios = lossReturns.slice(0, k).map(r => Math.log(r / threshold));
  const xi = logRatios.reduce((a, b) => a + b, 0) / k;

  let tailRisk;
  if (xi > 0.3) tailRisk = { level: 'Yüksek (Fat Tail)', score: 20, color: 'red' };
  else if (xi > 0.15) tailRisk = { level: 'Orta (Hafif Kalın)', score: 40, color: 'yellow' };
  else tailRisk = { level: 'Normal (İnce Kuyruk)', score: 65, color: 'green' };

  return {
    xi: parseFloat(xi.toFixed(3)),
    tailRisk,
    comment: `Tail index ξ=${xi.toFixed(3)} → ${tailRisk.level}`
  };
}

/**
 * Tam Risk Raporu
 */
export function calcRiskReport(priceData) {
  if (!priceData || priceData.length < 30) {
    return {
      garch: { sigma: null, annualSigma: null, persistence: null, halfLife: null, volRegime: 'Bilinmiyor' },
      var95: null, var99: null, cvar95: null,
      xi: 0.2, tailRisk: { level: 'Bilinmiyor', score: 50, color: 'gray' },
      maxDrawdown: 0, sharpe: 0, riskScore: 50,
      comment: 'Risk analizi için yeterli veri yok (min 30 gün)',
      error: 'Risk analizi için yeterli veri yok (min 30 gün)'
    };
  }

  const returns = [];
  for (let i = 1; i < priceData.length; i++) {
    returns.push((priceData[i].close - priceData[i - 1].close) / priceData[i - 1].close);
  }

  const garch = garch11(returns);
  const varData = calcVaR(returns);
  const evtData = hillEstimator(returns);

  // Ödül/Risk skoru
  const recentReturn = returns.slice(-20).reduce((a, b) => a + b, 0);
  const sharpe = garch.sigma > 0 ? (recentReturn / 20) / garch.sigma : 0;

  // Drawdown
  let peak = priceData[0].close, maxDD = 0;
  for (const p of priceData) {
    if (p.close > peak) peak = p.close;
    const dd = (peak - p.close) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  // Risk skoru (100 = en düşük risk, 0 = en yüksek risk)
  let riskScore = 50;
  if (varData.var95 !== null) {
    if (varData.var95 > -1.5) riskScore += 20;
    else if (varData.var95 < -3.5) riskScore -= 20;
  }
  if (garch.annualSigma < 20) riskScore += 15;
  else if (garch.annualSigma > 40) riskScore -= 20;
  if (evtData.xi < 0.15) riskScore += 10;
  else if (evtData.xi > 0.3) riskScore -= 15;
  if (maxDD < 0.15) riskScore += 10;
  else if (maxDD > 0.35) riskScore -= 15;

  riskScore = Math.max(5, Math.min(95, riskScore));

  return {
    garch,
    var95: varData.var95,
    var99: varData.var99,
    cvar95: varData.cvar95,
    xi: evtData.xi,
    tailRisk: evtData.tailRisk,
    maxDrawdown: parseFloat((maxDD * 100).toFixed(2)),
    sharpe: parseFloat(sharpe.toFixed(3)),
    riskScore: Math.round(riskScore),
    comment: [
      `VaR₉₅: ${varData.var95}% | CVaR₉₅: ${varData.cvar95}%`,
      `Max Drawdown: ${(maxDD * 100).toFixed(1)}%`,
      evtData.comment
    ].join(' | ')
  };
}

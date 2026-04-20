// v6.0-F-NANSRADAR Gelistirme

export function calculateVaR(returns, confidence = 0.95) {
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length);
  return {
    var95: parseFloat((sorted[Math.floor(0.05 * sorted.length)] * 100).toFixed(3)),
    var99: parseFloat((sorted[Math.floor(0.01 * sorted.length)] * 100).toFixed(3))
  };
}

export function calculateCVaR(returns, confidence = 0.95) {
  const sorted = [...returns].sort((a, b) => a - b);
  const cutoff = Math.floor((1 - confidence) * sorted.length);
  const tail = sorted.slice(0, cutoff);
  return parseFloat((tail.reduce((a, b) => a + b, 0) / tail.length * 100).toFixed(3));
}

export function calculateBeta(stockReturns, marketReturns) {
  const n = Math.min(stockReturns.length, marketReturns.length);
  const sr = stockReturns.slice(-n);
  const mr = marketReturns.slice(-n);
  const meanS = sr.reduce((a, b) => a + b, 0) / n;
  const meanM = mr.reduce((a, b) => a + b, 0) / n;
  let cov = 0, varM = 0;
  for (let i = 0; i < n; i++) {
    cov += (sr[i] - meanS) * (mr[i] - meanM);
    varM += (mr[i] - meanM) ** 2;
  }
  return parseFloat((cov / varM).toFixed(3));
}

export function calculateSortinoRatio(returns, riskFreeRate = 0) {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const downside = returns.filter(r => r < riskFreeRate);
  const downsideStd = Math.sqrt(
    downside.reduce((a, b) => a + (b - riskFreeRate) ** 2, 0) / returns.length
  );
  return parseFloat((downsideStd > 0 ? (mean - riskFreeRate) / downsideStd * Math.sqrt(252) : 0).toFixed(3));
}

export function calculateCalmarRatio(annualReturn, maxDrawdown) {
  return parseFloat((maxDrawdown > 0 ? annualReturn / maxDrawdown : 0).toFixed(3));
}

export function fullRiskAnalysis(returns, marketReturns = null) {
  const var_ = calculateVaR(returns);
  const cvar = calculateCVaR(returns);
  const sortino = calculateSortinoRatio(returns);
  const annualReturn = returns.reduce((a, b) => a + b, 0) / returns.length * 252 * 100;

  let peak = 1, capital = 1, maxDD = 0;
  for (const r of returns) {
    capital *= (1 + r);
    if (capital > peak) peak = capital;
    const dd = (peak - capital) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  return {
    var95: var_.var95,
    var99: var_.var99,
    cvar95: cvar,
    sortinoRatio: sortino,
    calmarRatio: calculateCalmarRatio(annualReturn, maxDD * 100),
    beta: marketReturns ? calculateBeta(returns, marketReturns) : null,
    annualizedReturn: parseFloat(annualReturn.toFixed(2)),
    maxDrawdown: parseFloat((maxDD * 100).toFixed(2))
  };
}

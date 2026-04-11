// Madde 36: Linear Regression
export const linearRegression = (data) => {
  if (!data || data.length < 2) return []
  const n = data.length
  const xs = data.map((_, i) => i)
  const ys = data.map(d => d.close)
  const xMean = xs.reduce((a, b) => a + b, 0) / n
  const yMean = ys.reduce((a, b) => a + b, 0) / n
  const slope = xs.reduce((s, x, i) => s + (x - xMean) * (ys[i] - yMean), 0) /
                xs.reduce((s, x) => s + (x - xMean) ** 2, 0)
  const intercept = yMean - slope * xMean
  return [1, 2, 3].map(i => ({
    date: `+${i}ay`,
    predicted: Math.round((intercept + slope * (n + i)) * 100) / 100
  }))
}

// Madde 37: EMA
export const calculateEMA = (data, period = 12) => {
  if (!data || data.length === 0) return []
  const k = 2 / (period + 1)
  let ema = data[0].close
  return data.map((d, i) => {
    if (i === 0) return { ...d, ema }
    ema = d.close * k + ema * (1 - k)
    return { ...d, ema: Math.round(ema * 100) / 100 }
  })
}

// Madde 38: Sharpe Ratio → 0-100 score
export const calculateSharpe = (returns, riskFreeRate = 0.30) => {
  if (!returns || returns.length < 2) return 50
  const monthlyRF = riskFreeRate / 12
  const excessReturns = returns.map(r => r - monthlyRF)
  const mean = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length
  const variance = excessReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / excessReturns.length
  const stdDev = Math.sqrt(variance)
  const sharpe = stdDev === 0 ? 0 : (mean / stdDev) * Math.sqrt(12)
  return Math.min(100, Math.max(0, Math.round((sharpe + 2) * 25)))
}

// Madde 42: Anomaly Detection
export const detectAnomalies = (data, threshold = 2) => {
  if (!data || data.length < 2) return data || []
  const returns = data.map((d, i) =>
    i === 0 ? 0 : (d.close - data[i-1].close) / data[i-1].close * 100
  )
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const std = Math.sqrt(returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length)
  return data.map((d, i) => ({
    ...d,
    isAnomaly: Math.abs(returns[i] - mean) > threshold * std,
    anomalyType: returns[i] > mean ? 'positive' : 'negative'
  }))
}

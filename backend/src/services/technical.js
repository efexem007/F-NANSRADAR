export const calculateSMA = (data, period) => {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  const sum = slice.reduce((acc, val) => acc + val.close, 0);
  return sum / period;
};

export const calculateRSI = (data, period = 14) => {
  if (data.length < period + 1) return null;
  const changes = [];
  for (let i = 1; i < data.length; i++) changes.push(data[i].close - data[i-1].close);
  const recentChanges = changes.slice(-period);
  const gains = recentChanges.map(c => c > 0 ? c : 0);
  const losses = recentChanges.map(c => c < 0 ? Math.abs(c) : 0);
  const avgGain = gains.reduce((a,b)=>a+b,0)/period;
  const avgLoss = losses.reduce((a,b)=>a+b,0)/period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

export const calculateMACD = (data) => {
  if (data.length < 26) return null;
  const ema = (values, period) => {
    const k = 2 / (period + 1);
    let emaArray = [values[0]];
    for (let i = 1; i < values.length; i++) emaArray.push(values[i] * k + emaArray[i-1] * (1 - k));
    return emaArray;
  };
  const closes = data.map(d => d.close);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.slice(-ema26.length).map((v,i) => v - ema26[i]);
  const signalLine = ema(macdLine, 9).slice(-9);
  return { macd: macdLine[macdLine.length - 1], signal: signalLine[signalLine.length - 1], hist: macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1], trend: macdLine[macdLine.length - 1] > signalLine[signalLine.length - 1] ? 'bullish' : 'bearish' };
};

export const calculateBollinger = (data, period = 20, multiplier = 2) => {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  const closes = slice.map(d => d.close);
  const sma = closes.reduce((a,b)=>a+b)/period;
  const squaredDiffs = closes.map(c => Math.pow(c - sma, 2));
  const stdDev = Math.sqrt(squaredDiffs.reduce((a,b)=>a+b)/period);
  return { upper: sma + (stdDev * multiplier), middle: sma, lower: sma - (stdDev * multiplier), width: ((2 * stdDev * multiplier) / sma) * 100 };
};

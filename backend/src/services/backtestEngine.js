// v6.0-F-NANSRADAR Gelistirme

export async function runBacktest(symbol, priceData, options = {}) {
  const {
    holdingPeriod = 5,
    stopLoss = 0.08,
    takeProfit = 0.15,
    initialCapital = 10000,
    period = 'ALL' // 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ALL'
  } = options;

  // Teknik sinyal üret (RSI + MACD + Bollinger)
  const signals = generateSignals(priceData);
  const trades = simulateTrades(signals, priceData, { holdingPeriod, stopLoss, takeProfit });
  const metrics = calculateMetrics(trades, initialCapital);

  return {
    symbol,
    period,
    ...metrics,
    trades: trades.slice(-50) // Son 50 trade
  };
}

function generateSignals(priceData) {
  const signals = [];
  const closes = priceData.map(p => p.close);

  for (let i = 50; i < closes.length; i++) {
    // RSI hesapla (14 periyot)
    const rsiWindow = closes.slice(i - 14, i);
    const gains = [], losses = [];
    for (let j = 1; j < rsiWindow.length; j++) {
      const diff = rsiWindow[j] - rsiWindow[j - 1];
      gains.push(diff > 0 ? diff : 0);
      losses.push(diff < 0 ? Math.abs(diff) : 0);
    }
    const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
    const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

    // SMA20 ve SMA50
    const sma20 = closes.slice(i - 20, i).reduce((a, b) => a + b, 0) / 20;
    const sma50 = closes.slice(i - 50, i).reduce((a, b) => a + b, 0) / 50;

    // Bollinger Bands
    const bbWindow = closes.slice(i - 20, i);
    const bbMean = bbWindow.reduce((a, b) => a + b, 0) / 20;
    const bbStd = Math.sqrt(bbWindow.reduce((a, b) => a + (b - bbMean) ** 2, 0) / 20);
    const bbLower = bbMean - 2 * bbStd;
    const bbUpper = bbMean + 2 * bbStd;

    // Sinyal mantığı
    let signal = 'BEKLE';
    let score = 50;

    if (rsi < 35 && closes[i] < bbLower && sma20 > sma50 * 0.98) {
      signal = 'GÜÇLÜ AL';
      score = 85;
    } else if (rsi < 45 && sma20 > sma50) {
      signal = 'AL';
      score = 70;
    } else if (rsi > 65 && closes[i] > bbUpper) {
      signal = 'SAT';
      score = 30;
    }

    if (signal !== 'BEKLE') {
      signals.push({
        date: priceData[i].date,
        price: closes[i],
        signal,
        score,
        rsi: parseFloat(rsi.toFixed(1))
      });
    }
  }
  return signals;
}

function simulateTrades(signals, priceData, options) {
  const { holdingPeriod, stopLoss, takeProfit } = options;
  const trades = [];

  for (const signal of signals) {
    if (signal.signal !== 'AL' && signal.signal !== 'GÜÇLÜ AL') continue;

    const entryIdx = priceData.findIndex(p =>
      new Date(p.date) >= new Date(signal.date)
    );
    if (entryIdx === -1) continue;

    const entryPrice = priceData[entryIdx].close;
    let exitPrice = entryPrice;
    let exitReason = 'HOLD_PERIOD';

    for (let j = entryIdx + 1; j <= entryIdx + holdingPeriod && j < priceData.length; j++) {
      const pnl = (priceData[j].close - entryPrice) / entryPrice;
      if (pnl <= -stopLoss) {
        exitPrice = priceData[j].close;
        exitReason = 'STOP_LOSS';
        break;
      }
      if (pnl >= takeProfit) {
        exitPrice = priceData[j].close;
        exitReason = 'TAKE_PROFIT';
        break;
      }
      exitPrice = priceData[j].close;
    }

    trades.push({
      entryDate: signal.date,
      entryPrice,
      exitPrice,
      exitReason,
      returnPct: parseFloat(((exitPrice - entryPrice) / entryPrice * 100).toFixed(2)),
      signal: signal.signal,
      score: signal.score
    });
  }
  return trades;
}

function calculateMetrics(trades, initialCapital) {
  if (trades.length === 0) return { error: 'Yeterli sinyal yok' };

  const wins = trades.filter(t => t.returnPct > 0);
  const losses = trades.filter(t => t.returnPct <= 0);

  let capital = initialCapital;
  let peak = capital;
  let maxDrawdown = 0;
  const equityCurve = [{ date: trades[0].entryDate, capital }];

  for (const t of trades) {
    capital *= (1 + t.returnPct / 100);
    if (capital > peak) peak = capital;
    const dd = (peak - capital) / peak * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
    equityCurve.push({ date: t.exitDate || t.entryDate, capital: parseFloat(capital.toFixed(2)) });
  }

  const returns = trades.map(t => t.returnPct);
  const meanR = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdR = Math.sqrt(returns.reduce((a, b) => a + (b - meanR) ** 2, 0) / returns.length);

  return {
    totalTrades: trades.length,
    winRate: parseFloat((wins.length / trades.length * 100).toFixed(2)),
    avgReturn: parseFloat(meanR.toFixed(2)),
    avgWin: wins.length > 0 ? parseFloat((wins.reduce((a, t) => a + t.returnPct, 0) / wins.length).toFixed(2)) : 0,
    avgLoss: losses.length > 0 ? parseFloat((losses.reduce((a, t) => a + t.returnPct, 0) / losses.length).toFixed(2)) : 0,
    profitFactor: losses.length > 0 && losses.reduce((a, t) => a + Math.abs(t.returnPct), 0) > 0
      ? parseFloat((wins.reduce((a, t) => a + t.returnPct, 0) / losses.reduce((a, t) => a + Math.abs(t.returnPct), 0)).toFixed(2))
      : 999,
    sharpeRatio: parseFloat((stdR > 0 ? meanR / stdR * Math.sqrt(252 / trades.length * trades.length) : 0).toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    finalCapital: parseFloat(capital.toFixed(2)),
    totalReturn: parseFloat(((capital - initialCapital) / initialCapital * 100).toFixed(2)),
    stopLossHits: trades.filter(t => t.exitReason === 'STOP_LOSS').length,
    takeProfitHits: trades.filter(t => t.exitReason === 'TAKE_PROFIT').length,
    equityCurve
  };
}

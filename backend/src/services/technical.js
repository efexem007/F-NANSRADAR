/**
 * FinansRadar — Technical Indicators v2.0
 * ========================================
 * Görev 46: RSI ✅
 * Görev 47: MACD ✅
 * Görev 48: SMA ✅
 * Görev 49: EMA ✅ (yeni)
 * Görev 50: Bollinger Bands ✅
 * Görev 51: Stochastic Oscillator ✅ (yeni)
 * Görev 52: ADX ✅ (yeni)
 * Görev 53: MFI ✅ (yeni)
 * Görev 54: Fibonacci Retracement ✅ (yeni)
 * Görev 55: Destek/Direnç Seviyeleri ✅ (yeni)
 */

// ═══════════════════════════════════════════════════════════════════════════
// MEVCUT İNDİKATÖRLER (Korundu + İyileştirildi)
// ═══════════════════════════════════════════════════════════════════════════

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
  
  // Wilder's smoothing (daha doğru RSI)
  let avgGain = 0, avgLoss = 0;
  const initial = changes.slice(0, period);
  avgGain = initial.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  avgLoss = initial.filter(c => c < 0).reduce((a, b) => a + Math.abs(b), 0) / period;

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

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
  return {
    macd: macdLine[macdLine.length - 1],
    signal: signalLine[signalLine.length - 1],
    hist: macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1],
    trend: macdLine[macdLine.length - 1] > signalLine[signalLine.length - 1] ? 'bullish' : 'bearish'
  };
};

export const calculateBollinger = (data, period = 20, multiplier = 2) => {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  const closes = slice.map(d => d.close);
  const sma = closes.reduce((a,b) => a+b) / period;
  const squaredDiffs = closes.map(c => Math.pow(c - sma, 2));
  const stdDev = Math.sqrt(squaredDiffs.reduce((a,b) => a+b) / period);
  return {
    upper: sma + (stdDev * multiplier),
    middle: sma,
    lower: sma - (stdDev * multiplier),
    width: ((2 * stdDev * multiplier) / sma) * 100
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// YENİ İNDİKATÖRLER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Görev 49: EMA (Exponential Moving Average)
 */
export const calculateEMA = (data, period) => {
  if (data.length < period) return null;
  const closes = data.map(d => d.close);
  const k = 2 / (period + 1);
  
  // İlk EMA = SMA
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < closes.length; i++) {
    ema = (closes[i] - ema) * k + ema;
  }
  
  return ema;
};

/**
 * Görev 51: Stochastic Oscillator
 * %K ve %D hesaplar
 */
export const calculateStochastic = (data, kPeriod = 14, dPeriod = 3) => {
  if (data.length < kPeriod + dPeriod) return null;
  
  // %K değerlerini hesapla
  const kValues = [];
  for (let i = kPeriod - 1; i < data.length; i++) {
    const window = data.slice(i - kPeriod + 1, i + 1);
    const highestHigh = Math.max(...window.map(p => p.high));
    const lowestLow = Math.min(...window.map(p => p.low));
    const range = highestHigh - lowestLow;
    const k = range === 0 ? 50 : ((data[i].close - lowestLow) / range) * 100;
    kValues.push(k);
  }

  const currentK = kValues[kValues.length - 1];
  
  // %D = %K'nın SMA'sı
  const dValues = kValues.slice(-dPeriod);
  const currentD = dValues.reduce((a, b) => a + b, 0) / dPeriod;

  // Sinyal üretimi
  let signal = 'neutral';
  if (currentK < 20 && currentD < 20) signal = 'oversold';
  else if (currentK > 80 && currentD > 80) signal = 'overbought';
  else if (currentK > currentD && kValues[kValues.length - 2] <= dValues[dValues.length - 2]) signal = 'bullish_cross';
  else if (currentK < currentD && kValues[kValues.length - 2] >= dValues[dValues.length - 2]) signal = 'bearish_cross';

  return {
    k: parseFloat(currentK.toFixed(2)),
    d: parseFloat(currentD.toFixed(2)),
    signal,
  };
};

/**
 * Görev 52: ADX (Average Directional Index)
 * Trend gücünü ölçer (0-100)
 */
export const calculateADX = (data, period = 14) => {
  if (data.length < period * 2 + 1) return null;

  const trueRanges = [];
  const plusDM = [];
  const minusDM = [];

  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevHigh = data[i - 1].high;
    const prevLow = data[i - 1].low;
    const prevClose = data[i - 1].close;

    // True Range
    trueRanges.push(Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    ));

    // Directional Movement
    const upMove = high - prevHigh;
    const downMove = prevLow - low;

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Wilder's smoothing
  const smooth = (arr, p) => {
    let smoothed = arr.slice(0, p).reduce((a, b) => a + b, 0);
    const result = [smoothed];
    for (let i = p; i < arr.length; i++) {
      smoothed = smoothed - (smoothed / p) + arr[i];
      result.push(smoothed);
    }
    return result;
  };

  const smoothTR = smooth(trueRanges, period);
  const smoothPlusDM = smooth(plusDM, period);
  const smoothMinusDM = smooth(minusDM, period);

  // DI+ ve DI-
  const diPlus = [];
  const diMinus = [];
  const dx = [];

  for (let i = 0; i < smoothTR.length; i++) {
    const di_plus = smoothTR[i] !== 0 ? (smoothPlusDM[i] / smoothTR[i]) * 100 : 0;
    const di_minus = smoothTR[i] !== 0 ? (smoothMinusDM[i] / smoothTR[i]) * 100 : 0;
    diPlus.push(di_plus);
    diMinus.push(di_minus);

    const sum = di_plus + di_minus;
    dx.push(sum !== 0 ? (Math.abs(di_plus - di_minus) / sum) * 100 : 0);
  }

  // ADX = DX'in Wilder's smoothing'i
  if (dx.length < period) return null;
  
  let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) {
    adx = ((adx * (period - 1)) + dx[i]) / period;
  }

  // Trend gücü yorumu
  let trendStrength = 'weak';
  if (adx > 50) trendStrength = 'very_strong';
  else if (adx > 25) trendStrength = 'strong';
  else if (adx > 20) trendStrength = 'moderate';

  return {
    adx: parseFloat(adx.toFixed(2)),
    diPlus: parseFloat(diPlus[diPlus.length - 1]?.toFixed(2) || 0),
    diMinus: parseFloat(diMinus[diMinus.length - 1]?.toFixed(2) || 0),
    trendStrength,
    isTrending: adx > 25,
    direction: diPlus[diPlus.length - 1] > diMinus[diMinus.length - 1] ? 'bullish' : 'bearish',
  };
};

/**
 * Görev 53: MFI (Money Flow Index)
 * Hacim ağırlıklı RSI - 0-100 arası
 */
export const calculateMFI = (data, period = 14) => {
  if (data.length < period + 1) return null;

  const typicalPrices = data.map(p => (p.high + p.low + p.close) / 3);
  const rawMoneyFlows = typicalPrices.map((tp, i) => tp * (data[i].volume || 0));

  let positiveFlow = 0;
  let negativeFlow = 0;

  // Son 'period' günü hesapla
  const startIdx = Math.max(1, data.length - period);
  for (let i = startIdx; i < data.length; i++) {
    if (typicalPrices[i] > typicalPrices[i - 1]) {
      positiveFlow += rawMoneyFlows[i];
    } else if (typicalPrices[i] < typicalPrices[i - 1]) {
      negativeFlow += rawMoneyFlows[i];
    }
  }

  if (negativeFlow === 0) return { mfi: 100, signal: 'overbought' };
  
  const moneyFlowRatio = positiveFlow / negativeFlow;
  const mfi = 100 - (100 / (1 + moneyFlowRatio));

  let signal = 'neutral';
  if (mfi < 20) signal = 'oversold';
  else if (mfi < 30) signal = 'weak';
  else if (mfi > 80) signal = 'overbought';
  else if (mfi > 70) signal = 'strong';

  return {
    mfi: parseFloat(mfi.toFixed(2)),
    signal,
    positiveFlow: Math.round(positiveFlow),
    negativeFlow: Math.round(negativeFlow),
  };
};

/**
 * Görev 54: Fibonacci Retracement Seviyeleri
 */
export const calculateFibonacci = (data) => {
  if (data.length < 20) return null;

  const highs = data.map(p => p.high);
  const lows = data.map(p => p.low);
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const diff = high - low;
  const currentPrice = data[data.length - 1].close;

  const levels = {
    '0.0': high,
    '0.236': high - diff * 0.236,
    '0.382': high - diff * 0.382,
    '0.5': high - diff * 0.5,
    '0.618': high - diff * 0.618,
    '0.786': high - diff * 0.786,
    '1.0': low,
  };

  // En yakın Fibonacci seviyesini bul
  let closestLevel = null;
  let closestDistance = Infinity;
  for (const [level, price] of Object.entries(levels)) {
    const dist = Math.abs(currentPrice - price);
    if (dist < closestDistance) {
      closestDistance = dist;
      closestLevel = { level, price: parseFloat(price.toFixed(2)), distance: parseFloat(dist.toFixed(2)) };
    }
  }

  // Fiyat hangi bölgede?
  let zone = 'neutral';
  const position = (high - currentPrice) / diff;
  if (position < 0.236) zone = 'resistance_zone';
  else if (position < 0.382) zone = 'weak_retracement';
  else if (position < 0.618) zone = 'moderate_retracement';
  else if (position < 0.786) zone = 'deep_retracement';
  else zone = 'support_zone';

  return {
    levels: Object.fromEntries(
      Object.entries(levels).map(([k, v]) => [k, parseFloat(v.toFixed(2))])
    ),
    currentPrice: parseFloat(currentPrice.toFixed(2)),
    closestLevel,
    zone,
    high: parseFloat(high.toFixed(2)),
    low: parseFloat(low.toFixed(2)),
  };
};

/**
 * Görev 55: Destek/Direnç Seviyeleri
 * Pivot Point yöntemi + yerel min/max tespiti
 */
export const calculateSupportResistance = (data, lookback = 5) => {
  if (data.length < lookback * 2 + 1) return null;

  const supports = [];
  const resistances = [];

  // Yerel min/max tespiti
  for (let i = lookback; i < data.length - lookback; i++) {
    const window = data.slice(i - lookback, i + lookback + 1);
    const currentLow = data[i].low;
    const currentHigh = data[i].high;
    
    const isLocalMin = window.every(p => currentLow <= p.low);
    const isLocalMax = window.every(p => currentHigh >= p.high);

    if (isLocalMin) {
      supports.push({
        price: parseFloat(currentLow.toFixed(2)),
        date: data[i].date,
        strength: 1,
      });
    }
    if (isLocalMax) {
      resistances.push({
        price: parseFloat(currentHigh.toFixed(2)),
        date: data[i].date,
        strength: 1,
      });
    }
  }

  // Benzer seviyeleri birleştir (kümeleme)
  const clusterLevels = (levels, threshold = 0.02) => {
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < levels.length; i++) {
      if (used.has(i)) continue;
      const cluster = [levels[i]];
      used.add(i);

      for (let j = i + 1; j < levels.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(levels[i].price - levels[j].price) / levels[i].price < threshold) {
          cluster.push(levels[j]);
          used.add(j);
        }
      }

      const avgPrice = cluster.reduce((a, b) => a + b.price, 0) / cluster.length;
      clusters.push({
        price: parseFloat(avgPrice.toFixed(2)),
        strength: cluster.length,
        lastTested: cluster[cluster.length - 1].date,
      });
    }

    return clusters.sort((a, b) => b.strength - a.strength);
  };

  const clusteredSupports = clusterLevels(supports);
  const clusteredResistances = clusterLevels(resistances);

  // Pivot Points (son gün bazlı)
  const lastBar = data[data.length - 1];
  const pivot = (lastBar.high + lastBar.low + lastBar.close) / 3;
  const s1 = 2 * pivot - lastBar.high;
  const r1 = 2 * pivot - lastBar.low;
  const s2 = pivot - (lastBar.high - lastBar.low);
  const r2 = pivot + (lastBar.high - lastBar.low);

  return {
    supports: clusteredSupports.slice(0, 5),
    resistances: clusteredResistances.slice(0, 5),
    closestSupport: clusteredSupports[0]?.price || null,
    closestResistance: clusteredResistances[0]?.price || null,
    pivotPoints: {
      pivot: parseFloat(pivot.toFixed(2)),
      s1: parseFloat(s1.toFixed(2)),
      s2: parseFloat(s2.toFixed(2)),
      r1: parseFloat(r1.toFixed(2)),
      r2: parseFloat(r2.toFixed(2)),
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// BİRLEŞİK İNDİKATÖR ANALİZİ (Görev 56-60)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tüm indikatörleri hesapla ve birleşik skor üret
 */
export const calculateAllIndicators = (data) => {
  const currentPrice = data[data.length - 1]?.close;
  if (!currentPrice) return null;

  const rsi = calculateRSI(data);
  const macd = calculateMACD(data);
  const sma20 = calculateSMA(data, 20);
  const sma50 = calculateSMA(data, 50);
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  const bollinger = calculateBollinger(data);
  const stochastic = calculateStochastic(data);
  const adx = calculateADX(data);
  const mfi = calculateMFI(data);
  const fibonacci = calculateFibonacci(data);
  const supportResistance = calculateSupportResistance(data);

  // ─── Birleşik Sinyal Skoru ───────────────────────────────────────────
  let compositeScore = 50; // Başlangıç: nötr
  let buySignals = 0;
  let sellSignals = 0;
  let totalSignals = 0;

  // RSI sinyali
  if (rsi !== null) {
    totalSignals++;
    if (rsi < 30) { compositeScore += 8; buySignals++; }
    else if (rsi < 40) { compositeScore += 3; buySignals++; }
    else if (rsi > 70) { compositeScore -= 8; sellSignals++; }
    else if (rsi > 60) { compositeScore -= 3; sellSignals++; }
  }

  // MACD sinyali
  if (macd) {
    totalSignals++;
    if (macd.hist > 0 && macd.macd > macd.signal) { compositeScore += 7; buySignals++; }
    else if (macd.hist > 0) { compositeScore += 3; buySignals++; }
    else if (macd.hist < 0 && macd.macd < macd.signal) { compositeScore -= 7; sellSignals++; }
    else { compositeScore -= 3; sellSignals++; }
  }

  // SMA Golden/Death Cross
  if (sma20 && sma50) {
    totalSignals++;
    if (sma20 > sma50 && currentPrice > sma20) { compositeScore += 6; buySignals++; }
    else if (sma20 > sma50) { compositeScore += 2; buySignals++; }
    else if (sma20 < sma50 && currentPrice < sma20) { compositeScore -= 6; sellSignals++; }
    else { compositeScore -= 2; sellSignals++; }
  }

  // Bollinger sinyali
  if (bollinger) {
    totalSignals++;
    const pos = (currentPrice - bollinger.lower) / (bollinger.upper - bollinger.lower);
    if (pos < 0.15) { compositeScore += 6; buySignals++; }
    else if (pos < 0.3) { compositeScore += 2; buySignals++; }
    else if (pos > 0.85) { compositeScore -= 6; sellSignals++; }
    else if (pos > 0.7) { compositeScore -= 2; sellSignals++; }
  }

  // Stochastic sinyali
  if (stochastic) {
    totalSignals++;
    if (stochastic.signal === 'oversold' || stochastic.signal === 'bullish_cross') { compositeScore += 5; buySignals++; }
    else if (stochastic.signal === 'overbought' || stochastic.signal === 'bearish_cross') { compositeScore -= 5; sellSignals++; }
  }

  // ADX sinyali
  if (adx) {
    totalSignals++;
    if (adx.isTrending && adx.direction === 'bullish') { compositeScore += 5; buySignals++; }
    else if (adx.isTrending && adx.direction === 'bearish') { compositeScore -= 5; sellSignals++; }
  }

  // MFI sinyali
  if (mfi) {
    totalSignals++;
    if (mfi.signal === 'oversold') { compositeScore += 5; buySignals++; }
    else if (mfi.signal === 'overbought') { compositeScore -= 5; sellSignals++; }
  }

  compositeScore = Math.max(0, Math.min(100, compositeScore));

  // Sinyal uyumu (consensus)
  const consensus = totalSignals > 0
    ? parseFloat(((buySignals / totalSignals) * 100).toFixed(1))
    : 50;

  let compositeSignal;
  if (compositeScore >= 75) compositeSignal = 'GÜÇLÜ AL';
  else if (compositeScore >= 60) compositeSignal = 'AL';
  else if (compositeScore >= 45) compositeSignal = 'BEKLE';
  else if (compositeScore >= 30) compositeSignal = 'SAT';
  else compositeSignal = 'GÜÇLÜ SAT';

  return {
    currentPrice,
    rsi,
    macd,
    sma: { sma20, sma50 },
    ema: { ema12, ema26 },
    bollinger,
    stochastic,
    adx,
    mfi,
    fibonacci,
    supportResistance,
    composite: {
      score: compositeScore,
      signal: compositeSignal,
      buySignals,
      sellSignals,
      totalSignals,
      consensus,
    },
  };
};

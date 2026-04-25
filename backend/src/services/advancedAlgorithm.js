/**
 * F-NANSRADAR — 10-Step Advanced Analysis Algorithm v7.0
 * ======================================================
 * Her hisse için 10 farklı analiz basamağından geçerek
 * 0-100 arası final skor ve sinyal üretir.
 */

import { calculateRSI, calculateMACD, calculateSMA, calculateEMA, calculateBollinger, calculateATR, calculateStochastic, calculateCCI } from './technical.js';
import { getMacroData } from './macroData.js';
import { fetchStockPrices } from './yahooFinance.js';

// ═══════════════════════════════════════════════════════════════════════════
// STEP WEIGHTS (customizable)
// ═══════════════════════════════════════════════════════════════════════════
const STEP_WEIGHTS = {
  trend: 0.10,
  momentum: 0.10,
  volatility: 0.10,
  volume: 0.10,
  supportResistance: 0.10,
  fundamental: 0.10,
  sectoral: 0.10,
  macro: 0.10,
  aiPrediction: 0.15,
  sentiment: 0.05,
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
function normalize(value, min, max) { return max === min ? 50 : clamp(((value - min) / (max - min)) * 100, 0, 100); }

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: TREND ANALYSIS (SMA/EMA/ADX)
// ═══════════════════════════════════════════════════════════════════════════
function analyzeTrend(priceData) {
  const closes = priceData.map(p => p.close);
  const sma20 = calculateSMA(priceData, 20);
  const sma50 = calculateSMA(priceData, 50);
  const sma200 = calculateSMA(priceData, 200);
  const ema20 = calculateEMA(priceData, 20);
  const current = closes[closes.length - 1];

  let score = 50;
  if (sma20 && sma50 && sma200) {
    if (current > sma20 && sma20 > sma50 && sma50 > sma200) score += 25; // Golden alignment
    else if (current > sma20 && sma20 > sma50) score += 15;
    else if (current > sma20) score += 5;
    else if (current < sma20 && sma20 < sma50 && sma50 < sma200) score -= 25; // Death alignment
    else if (current < sma20 && sma20 < sma50) score -= 15;
    else if (current < sma20) score -= 5;
  }
  if (ema20) {
    if (current > ema20) score += 5;
    else score -= 5;
  }

  return clamp(score, 0, 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: MOMENTUM (RSI, MACD, Stochastic, CCI)
// ═══════════════════════════════════════════════════════════════════════════
function analyzeMomentum(priceData) {
  const rsi = calculateRSI(priceData);
  const macd = calculateMACD(priceData);
  const stoch = calculateStochastic(priceData);
  const cci = calculateCCI(priceData);

  let score = 50;

  // RSI
  if (rsi != null) {
    if (rsi < 30) score += 15; // Oversold
    else if (rsi < 40) score += 8;
    else if (rsi > 70) score -= 15; // Overbought
    else if (rsi > 60) score -= 8;
  }

  // MACD
  if (macd) {
    if (macd.hist > 0 && macd.macd > macd.signal) score += 12;
    else if (macd.hist > 0) score += 5;
    else if (macd.hist < 0 && macd.macd < macd.signal) score -= 12;
    else score -= 5;
  }

  // Stochastic
  if (stoch) {
    if (stoch.k < 20) score += 8;
    else if (stoch.k > 80) score -= 8;
  }

  // CCI
  if (cci != null) {
    if (cci < -100) score += 8;
    else if (cci > 100) score -= 8;
  }

  return clamp(score, 0, 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: VOLATILITE (Bollinger, ATR)
// ═══════════════════════════════════════════════════════════════════════════
function analyzeVolatility(priceData) {
  const bollinger = calculateBollinger(priceData);
  const atr = calculateATR(priceData);
  const closes = priceData.map(p => p.close);
  const current = closes[closes.length - 1];

  let score = 50;

  if (bollinger) {
    const pos = (current - bollinger.lower) / (bollinger.upper - bollinger.lower);
    if (pos < 0.15) score += 15; // Near lower band = potential bounce
    else if (pos < 0.3) score += 8;
    else if (pos > 0.85) score -= 15; // Near upper band = potential reversal
    else if (pos > 0.7) score -= 8;
  }

  // ATR - Lower ATR = more stable = better for entry
  if (atr != null) {
    const avgPrice = closes.reduce((a, b) => a + b, 0) / closes.length;
    const atrPct = (atr / avgPrice) * 100;
    if (atrPct < 2) score += 10;
    else if (atrPct < 3) score += 5;
    else if (atrPct > 6) score -= 10;
    else if (atrPct > 4) score -= 5;
  }

  return clamp(score, 0, 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: VOLUME ANALYSIS (OBV, Relative Volume)
// ═══════════════════════════════════════════════════════════════════════════
function analyzeVolume(priceData) {
  const volumes = priceData.map(p => p.volume || 0);
  const closes = priceData.map(p => p.close);
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const lastVolume = volumes[volumes.length - 1];
  const relVolume = avgVolume > 0 ? lastVolume / avgVolume : 1;

  // OBV calculation
  let obv = 0;
  for (let i = 1; i < priceData.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
  }

  let score = 50;

  // Relative Volume
  if (relVolume > 2) score += 15; // Strong volume surge
  else if (relVolume > 1.5) score += 10;
  else if (relVolume > 1.2) score += 5;
  else if (relVolume < 0.5) score -= 10;

  // Price-volume divergence
  const priceChange5d = closes.length >= 5
    ? ((closes[closes.length - 1] / closes[closes.length - 5]) - 1) * 100
    : 0;
  const obvChange5d = 0; // Simplified

  if (priceChange5d > 2 && relVolume > 1.3) score += 5; // Price up with volume
  if (priceChange5d < -2 && relVolume > 1.3) score -= 5; // Price down with volume

  return clamp(score, 0, 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 5: SUPPORT / RESISTANCE (Pivot Points, Fibonacci)
// ═══════════════════════════════════════════════════════════════════════════
function analyzeSupportResistance(priceData) {
  const highs = priceData.map(p => p.high);
  const lows = priceData.map(p => p.low);
  const closes = priceData.map(p => p.close);
  const current = closes[closes.length - 1];
  const lastHigh = Math.max(...highs.slice(-20));
  const lastLow = Math.min(...lows.slice(-20));

  // Pivot Points
  const pp = (lastHigh + lastLow + closes[closes.length - 1]) / 3;
  const r1 = 2 * pp - lastLow;
  const s1 = 2 * pp - lastHigh;

  let score = 50;

  const distToS1 = ((current - s1) / current) * 100;
  const distToR1 = ((r1 - current) / current) * 100;

  if (distToS1 > 0 && distToS1 < 2) score += 12; // Near support
  else if (distToR1 > 0 && distToR1 < 2) score -= 12; // Near resistance
  else if (distToS1 > 0 && distToS1 < 5) score += 6;
  else if (distToR1 > 0 && distToR1 < 5) score -= 6;

  // Distance between support and resistance
  const range = ((r1 - s1) / current) * 100;
  if (range > 10) score += 5; // Wide range = room to move

  return clamp(score, 0, 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 6: FUNDAMENTAL ANALYSIS (P/E, Current Ratio, Net Margin, ROE)
// ═══════════════════════════════════════════════════════════════════════════
function analyzeFundamental(ratios = {}) {
  let score = 50;
  const { fk, pdDd, currentRatio, netMargin, roe } = ratios;

  if (fk != null) {
    if (fk > 0 && fk < 10) score += 15;
    else if (fk < 15) score += 10;
    else if (fk < 25) score += 5;
    else if (fk > 50) score -= 15;
    else if (fk > 35) score -= 8;
  }

  if (currentRatio != null) {
    if (currentRatio > 2) score += 10;
    else if (currentRatio > 1.5) score += 5;
    else if (currentRatio < 1) score -= 10;
  }

  if (netMargin != null) {
    if (netMargin > 15) score += 10;
    else if (netMargin > 8) score += 5;
    else if (netMargin < 0) score -= 10;
    else if (netMargin < 3) score -= 5;
  }

  if (roe != null) {
    if (roe > 20) score += 10;
    else if (roe > 10) score += 5;
    else if (roe < 0) score -= 10;
  }

  return clamp(score, 0, 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 7: SECTORAL ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════
function analyzeSectoral(priceData, sectorData = {}) {
  const closes = priceData.map(p => p.close);
  const change7d = closes.length >= 7
    ? ((closes[closes.length - 1] / closes[closes.length - 7]) - 1) * 100
    : 0;
  const change30d = closes.length >= 30
    ? ((closes[closes.length - 1] / closes[closes.length - 30]) - 1) * 100
    : 0;

  let score = 50;

  // Compare stock vs sector average
  if (sectorData.avgChange7d != null) {
    if (change7d > sectorData.avgChange7d + 2) score += 10;
    else if (change7d > sectorData.avgChange7d) score += 5;
    else if (change7d < sectorData.avgChange7d - 2) score -= 10;
  }

  // Stock's own performance
  if (change7d > 5) score += 8;
  else if (change7d > 2) score += 4;
  else if (change7d < -5) score -= 8;
  else if (change7d < -2) score -= 4;

  if (change30d > 15) score += 7;
  else if (change30d < -15) score -= 7;

  return clamp(score, 0, 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 8: MACRO IMPACT ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════
async function analyzeMacroImpact() {
  try {
    const macro = await getMacroData();
    let score = 50;

    // USD/TRY - weaker TRY is generally bad for BIST short term but can help exports
    if (macro.usdtry) {
      const usdChange = macro.usdtry.change1d || 0;
      if (usdChange > 2) score -= 10; // Rapid TRY depreciation
      else if (usdChange > 1) score -= 5;
      else if (usdChange < -1) score += 5; // TRY strengthening
    }

    // Interest rates
    if (macro.interest) {
      const rate = macro.interest.value || 50;
      if (rate > 45) score -= 10; // Very high rates = pressure on stocks
      else if (rate < 30) score += 10; // Lower rates = positive for stocks
    }

    // CDS - lower is better
    if (macro.cds) {
      const cds = macro.cds.value || 300;
      if (cds > 600) score -= 15;
      else if (cds > 400) score -= 8;
      else if (cds < 250) score += 10;
    }

    // VIX - market fear index
    if (macro.vix) {
      const vix = macro.vix.value || 18;
      if (vix > 30) score -= 10; // High fear
      else if (vix < 15) score += 5; // Low fear / complacency
    }

    return clamp(score, 0, 100);
  } catch {
    return 50; // Neutral on error
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 9: AI PREDICTION
// ═══════════════════════════════════════════════════════════════════════════
function analyzeAIPrediction(priceData) {
  const closes = priceData.map(p => p.close);
  if (closes.length < 30) return 50;

  // Simple linear regression for short-term prediction
  const n = Math.min(30, closes.length);
  const recent = closes.slice(-n);
  const xMean = (n - 1) / 2;
  const yMean = recent.reduce((a, b) => a + b, 0) / n;

  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (recent[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  const predicted = recent[n - 1] + slope * 5; // Predict 5 days ahead
  const changePct = ((predicted / recent[n - 1]) - 1) * 100;

  let score = 50;
  if (changePct > 5) score += 20;
  else if (changePct > 2) score += 12;
  else if (changePct > 0) score += 5;
  else if (changePct < -5) score -= 20;
  else if (changePct < -2) score -= 12;
  else if (changePct < 0) score -= 5;

  return clamp(score, 0, 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 10: MARKET SENTIMENT
// ═══════════════════════════════════════════════════════════════════════════
function analyzeSentiment(priceData) {
  const closes = priceData.map(p => p.close);
  const volumes = priceData.map(p => p.volume || 0);

  // Simple sentiment based on recent price action
  const change1d = closes.length >= 2
    ? ((closes[closes.length - 1] / closes[closes.length - 2]) - 1) * 100
    : 0;
  const change3d = closes.length >= 4
    ? ((closes[closes.length - 1] / closes[closes.length - 4]) - 1) * 100
    : 0;

  let score = 50;

  // Consecutive up/down days
  let upDays = 0, downDays = 0;
  for (let i = closes.length - 5; i < closes.length - 1; i++) {
    if (closes[i + 1] > closes[i]) upDays++;
    else if (closes[i + 1] < closes[i]) downDays++;
  }

  if (upDays >= 4) score += 10;
  else if (upDays >= 3) score += 5;
  else if (downDays >= 4) score -= 10;
  else if (downDays >= 3) score -= 5;

  // Volume on up vs down days
  const lastVol = volumes[volumes.length - 1];
  const avgVol = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
  if (change1d > 0 && lastVol > avgVol * 1.3) score += 5;
  if (change1d < 0 && lastVol > avgVol * 1.3) score -= 5;

  return clamp(score, 0, 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

export async function analyzeAsset10Step(symbol, name, assetType, options = {}) {
  const { timeFrame = '1D', includeFundamental = false, ratios = null, sectorData = null } = options;

  // Fetch price data
  let priceData, currentPrice;
  try {
    const result = await fetchStockPrices(symbol, '3mo', '1d');
    priceData = result.priceData;
    currentPrice = result.currentPrice;
  } catch (e) {
    throw new Error(`${symbol}: Fiyat verisi alınamadı - ${e.message}`);
  }

  if (!priceData || priceData.length < 30) {
    throw new Error(`${symbol}: Yetersiz veri (minimum 30 gün gerekli)`);
  }

  // Run all 10 steps
  const steps = {
    trend: analyzeTrend(priceData),
    momentum: analyzeMomentum(priceData),
    volatility: analyzeVolatility(priceData),
    volume: analyzeVolume(priceData),
    supportResistance: analyzeSupportResistance(priceData),
    fundamental: includeFundamental ? analyzeFundamental(ratios || {}) : 50,
    sectoral: analyzeSectoral(priceData, sectorData || {}),
    macro: await analyzeMacroImpact(),
    aiPrediction: analyzeAIPrediction(priceData),
    sentiment: analyzeSentiment(priceData),
  };

  // Calculate weighted final score
  const finalScore = Math.round(
    steps.trend * STEP_WEIGHTS.trend +
    steps.momentum * STEP_WEIGHTS.momentum +
    steps.volatility * STEP_WEIGHTS.volatility +
    steps.volume * STEP_WEIGHTS.volume +
    steps.supportResistance * STEP_WEIGHTS.supportResistance +
    steps.fundamental * STEP_WEIGHTS.fundamental +
    steps.sectoral * STEP_WEIGHTS.sectoral +
    steps.macro * STEP_WEIGHTS.macro +
    steps.aiPrediction * STEP_WEIGHTS.aiPrediction +
    steps.sentiment * STEP_WEIGHTS.sentiment
  );

  // Signal determination
  let signal, signalColor;
  if (finalScore >= 75) { signal = 'GÜÇLÜ AL'; signalColor = 'emerald'; }
  else if (finalScore >= 60) { signal = 'AL'; signalColor = 'green'; }
  else if (finalScore >= 45) { signal = 'BEKLE'; signalColor = 'amber'; }
  else if (finalScore >= 30) { signal = 'SAT'; signalColor = 'orange'; }
  else { signal = 'GÜÇLÜ SAT'; signalColor = 'red'; }

  // Risk level
  const volatility = steps.volatility;
  let riskLevel = 'Orta';
  if (volatility > 70) riskLevel = 'Çok Yüksek';
  else if (volatility > 55) riskLevel = 'Yüksek';
  else if (volatility < 35) riskLevel = 'Düşük';

  // Predictions
  const closes = priceData.map(p => p.close);
  const change7d = closes.length >= 7 ? ((closes[closes.length - 1] / closes[closes.length - 7]) - 1) * 100 : 0;
  const change30d = closes.length >= 30 ? ((closes[closes.length - 1] / closes[closes.length - 30]) - 1) * 100 : 0;

  return {
    symbol,
    name: name || symbol,
    type: assetType,
    currentPrice: parseFloat(currentPrice?.toFixed(4) || 0),
    change1d: closes.length >= 2 ? parseFloat(((closes[closes.length - 1] / closes[closes.length - 2] - 1) * 100).toFixed(2)) : 0,
    change7d: parseFloat(change7d.toFixed(2)),
    change30d: parseFloat(change30d.toFixed(2)),
    opportunityScore: finalScore,
    signal,
    signalColor,
    riskLevel,
    steps, // Detailed step scores
    indicators: {
      rsi: calculateRSI(priceData),
      macd: calculateMACD(priceData),
      sma20: calculateSMA(priceData, 20),
      sma50: calculateSMA(priceData, 50),
      bollinger: calculateBollinger(priceData),
    },
    lastUpdate: new Date().toISOString(),
  };
}

export default analyzeAsset10Step;

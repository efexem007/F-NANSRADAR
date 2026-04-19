export const fundamentalScore = (ratios) => {
  let score = 0;
  if (ratios.currentRatio >= 2) score += 25;
  else if (ratios.currentRatio >= 1.5) score += 15;
  else if (ratios.currentRatio >= 1) score += 5;
  if (ratios.netMargin >= 10) score += 25;
  else if (ratios.netMargin >= 5) score += 15;
  else if (ratios.netMargin > 0) score += 5;
  if (ratios.leverage <= 2) score += 25;
  else if (ratios.leverage <= 3) score += 15;
  else if (ratios.leverage <= 4) score += 5;
  if (ratios.nfbToEbitda <= 2) score += 25;
  else if (ratios.nfbToEbitda <= 3) score += 15;
  else if (ratios.nfbToEbitda <= 4) score += 5;
  return score;
};

export const technicalScore = (tech) => {
  let score = 50; // Nötr başlangıç

  // RSI (ağırlık 0.22) - Sigmoid skorlama
  if (tech.rsi14 != null) {
    const rsiDev = (50 - tech.rsi14) / 25; // -2 ile +2 arası
    score += (50 * Math.tanh(rsiDev)) * 0.22;
  }

  // MACD (ağırlık 0.20) - Histogram gücüne duyarlı
  if (tech.macdHist != null) {
    const macdPower = tech.macdHist > 0 && tech.macdHist > (tech.macdSignal || 0)
      ? 1.0
      : tech.macdHist > 0 ? 0.5 : tech.macdHist < 0 && tech.macdHist < (tech.macdSignal || 0) ? -1.0 : -0.5;
    score += macdPower * 25 * 0.20;
  }

  // SMA Cross (ağırlık 0.16)
  if (tech.sma20 != null && tech.sma50 != null) {
    const crossStrength = (tech.sma20 - tech.sma50) / tech.sma50;
    const smaPower = tech.currentPrice > tech.sma20 && tech.sma20 > tech.sma50
      ? 1.0 + crossStrength * 5
      : tech.sma20 > tech.sma50 ? 0.5 + crossStrength * 3 : tech.currentPrice < tech.sma20 && tech.sma20 < tech.sma50 ? -1.0 : -0.5;
    score += smaPower * 25 * 0.16;
  }

  // Bollinger (ağırlık 0.14)
  if (tech.bollingerLower != null && tech.currentPrice != null) {
    const bbPos = (tech.bollingerUpper && tech.bollingerLower)
      ? (tech.currentPrice - tech.bollingerLower) / (tech.bollingerUpper - tech.bollingerLower)
      : 0.5;
    const bbPower = bbPos < 0.1 ? 1.0 : bbPos < 0.25 ? 0.6 : bbPos > 0.9 ? -1.0 : bbPos > 0.75 ? -0.6 : 0;
    score += bbPower * 25 * 0.14;
  }

  // Stochastic (ağırlık 0.12) - Eklendi
  if (tech.stochasticSignal) {
    const stochPower = tech.stochasticSignal === 'oversold' ? 1.0
      : tech.stochasticSignal === 'bullish_cross' ? 0.8
      : tech.stochasticSignal === 'overbought' ? -1.0
      : tech.stochasticSignal === 'bearish_cross' ? -0.8 : 0;
    score += stochPower * 25 * 0.12;
  }

  // ADX Trend (ağırlık 0.10) - Eklendi
  if (tech.adx != null && tech.adxDirection) {
    const adxPower = tech.adx > 25
      ? (tech.adxDirection === 'bullish' ? 1.0 : -1.0) * Math.min(tech.adx / 50, 1)
      : 0;
    score += adxPower * 25 * 0.10;
  }

  // MFI (ağırlık 0.06) - Eklendi
  if (tech.mfiSignal) {
    const mfiPower = tech.mfiSignal === 'oversold' ? 1.0
      : tech.mfiSignal === 'overbought' ? -1.0 : 0;
    score += mfiPower * 25 * 0.06;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
};

export const macroScore = (cds, vix) => {
  let score = 50;
  if (cds < 200) score += 20;
  else if (cds < 300) score += 5;
  else if (cds > 400) score -= 20;
  else if (cds > 300) score -= 10;
  if (vix < 20) score += 15;
  else if (vix < 30) score += 5;
  else score -= 15;
  return Math.min(100, Math.max(0, score));
};

export const calculateFinalSignal = (fundScore, techScore, macroScoreVal) => {
  const total = fundScore * 0.4 + techScore * 0.35 + macroScoreVal * 0.25;
  let signal = 'BEKLE';
  if (total >= 70) signal = 'GUCLU AL';
  else if (total >= 55) signal = 'AL';
  else if (total >= 40) signal = 'BEKLE';
  else if (total >= 25) signal = 'SAT';
  else signal = 'GUCLU SAT';
  return { signal, score: Math.round(total) };
};

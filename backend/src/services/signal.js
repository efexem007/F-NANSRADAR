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
  let score = 0;
  if (tech.rsi14 < 30) score += 35;
  else if (tech.rsi14 > 70) score += 0;
  else if (tech.rsi14 < 50) score += 20;
  else score += 10;
  if (tech.macdHist > 0) score += 25;
  else score += 5;
  if (tech.sma20 > tech.sma50) score += 20;
  else score += 5;
  if (tech.bollingerLower && tech.currentPrice <= tech.bollingerLower * 1.02) score += 20;
  else score += 5;
  return Math.min(100, score);
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

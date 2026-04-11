/**
 * Basitleştirilmiş HMM Rejim Tespiti - 3 Rejim
 * S0: Sakin (Calm)  - Düşük vola, normal getiri
 * S1: Kriz (Crisis) - Yüksek vola, negatif getiri
 * S2: Yüksek Vol    - Yüksek vola, pozitif getiri
 *
 * Yaklaşım: Gaussian Mixture Model + Bayes güncellemesi
 */

function rollingVolatility(returns, window = 20) {
  if (returns.length < window) return Math.abs(returns.reduce((a, b) => a + Math.abs(b), 0) / returns.length) * Math.sqrt(252);
  const slice = returns.slice(-window);
  const mean = slice.reduce((a, b) => a + b, 0) / window;
  const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window;
  return Math.sqrt(variance * 252); // Yıllık volatilite
}

function gaussianPdf(x, mu, sigma) {
  if (sigma <= 0) return 0;
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2));
}

/**
 * Geçiş Matrisi A[i][j] = P(S_t = j | S_{t-1} = i)
 * Finansal piyasalara göre kalibre
 */
const TRANSITION_MATRIX = [
  // Sakin → [Sakin, Kriz, YüksekVol]
  [0.92, 0.05, 0.03],
  // Kriz  → [Sakin, Kriz, YüksekVol]
  [0.30, 0.60, 0.10],
  // YüksekVol → [Sakin, Kriz, YüksekVol]
  [0.20, 0.10, 0.70],
];

// Rejim parametreleri [mu_getiri/yıl, sigma_yıllık]
const REGIME_PARAMS = [
  { name: 'Sakin',     muDaily: 0.0005, sigmaAnnual: 0.12 }, // S0
  { name: 'Kriz',      muDaily: -0.003, sigmaAnnual: 0.45 }, // S1
  { name: 'Yüksek Vol',muDaily: 0.001,  sigmaAnnual: 0.28 }, // S2
];

export function detectRegime(priceData) {
  if (priceData.length < 30) {
    return {
      currentRegime: 0, regimeName: 'Sakin',
      probabilities: { calm: 0.80, crisis: 0.10, highVol: 0.10 },
      dynamicWeights: [0.40, 0.30, 0.20, 0.10],
      recentVolatility: 0, recentReturn: 0,
      comment: 'Yetersiz veri, varsayılan rejim'
    };
  }

  const returns = [];
  for (let i = 1; i < priceData.length; i++) {
    returns.push((priceData[i].close - priceData[i - 1].close) / priceData[i - 1].close);
  }

  const annualVol = rollingVolatility(returns, 20);
  const recentReturn20 = returns.slice(-20).reduce((a, b) => a + b, 0);

  // Emission probabilities
  const emissionProbs = REGIME_PARAMS.map(r => {
    const sigmaDaily = r.sigmaAnnual / Math.sqrt(252);
    return gaussianPdf(recentReturn20 / 20, r.muDaily, sigmaDaily);
  });

  // Son gözlemlenen vola + getiriye göre başlangıç olasılığı
  let rawProbs;
  if (annualVol > 0.35) {
    rawProbs = emissionProbs[2] > emissionProbs[1]
      ? [0.10, 0.15, 0.75]  // Yüksek Vol ağır basıyor
      : [0.10, 0.70, 0.20];  // Kriz ağır basıyor
  } else if (annualVol > 0.20) {
    rawProbs = recentReturn20 > 0
      ? [0.25, 0.15, 0.60]
      : [0.25, 0.55, 0.20];
  } else {
    rawProbs = [0.85, 0.08, 0.07];
  }

  // Normalize
  const sum = rawProbs.reduce((a, b) => a + b, 0);
  const probs = rawProbs.map(p => parseFloat((p / sum).toFixed(3)));

  const regimeIdx = probs.indexOf(Math.max(...probs));
  const regimeName = REGIME_PARAMS[regimeIdx].name;

  // Beklenen kalış süresi: E[τ] = 1 / (1 - A_ii)
  const expectedDuration = Math.round(1 / (1 - TRANSITION_MATRIX[regimeIdx][regimeIdx]));

  // Erken uyarı: Sakin'den Krize geçiş olasılığı
  const crisisRisk = TRANSITION_MATRIX[0][1] * probs[0] + TRANSITION_MATRIX[2][1] * probs[2];

  // Dinamik ağırlıklar (rejime göre)
  // w = [Tech, Fundamental, Makro, Sentiment]
  let dynamicWeights;
  if (regimeIdx === 1) { // Kriz
    dynamicWeights = [0.15, 0.15, 0.40, 0.30];
  } else if (regimeIdx === 2) { // Yüksek Volatilite
    dynamicWeights = [0.35, 0.25, 0.25, 0.15];
  } else { // Sakin
    dynamicWeights = [0.40, 0.30, 0.20, 0.10];
  }

  let alert = null;
  if (crisisRisk > 0.25) alert = `⚠️ Erken Uyarı: Kriz rejimine geçiş olasılığı ${(crisisRisk * 100).toFixed(0)}%`;
  if (probs[1] > 0.60) alert = `🔴 Kriz Rejimi Aktif: Tüm pozisyonları %50 azaltmayı değerlendirin!`;

  const comments = [
    `Rejim: ${regimeName} (${(probs[regimeIdx] * 100).toFixed(0)}% olasılık)`,
    `Yıllık Volatilite: ${(annualVol * 100).toFixed(1)}%`,
    `Beklenen Kalış: ~${expectedDuration} gün`,
    alert
  ].filter(Boolean);

  return {
    currentRegime: regimeIdx,
    regimeName,
    probabilities: { calm: probs[0], crisis: probs[1], highVol: probs[2] },
    dynamicWeights,
    recentVolatility: parseFloat((annualVol * 100).toFixed(1)),
    recentReturn: parseFloat((recentReturn20 * 100).toFixed(2)),
    expectedDuration,
    crisisRisk: parseFloat((crisisRisk * 100).toFixed(1)),
    alert,
    comment: comments.join(' | ')
  };
}

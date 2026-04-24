// v6.0-F-NANSRADAR Gelistirme

export function calculateAdaptiveDrift(returns, shortWindow = 20, longWindow = 100) {
  const shortDrift = returns.slice(-shortWindow).reduce((a, b) => a + b, 0) / shortWindow;
  const longDrift = returns.slice(-longWindow).reduce((a, b) => a + b, 0) / longWindow;
  const trendStrength = Math.abs(shortDrift) / (Math.abs(longDrift) + 1e-10);
  const normalizedStrength = Math.min(trendStrength / 3, 1);
  const adaptiveDrift = shortDrift * normalizedStrength + longDrift * (1 - normalizedStrength);

  return {
    shortDrift,
    longDrift,
    adaptiveDrift,
    trendStrength: normalizedStrength,
    regime: shortDrift > longDrift * 1.5 ? 'accelerating' :
            shortDrift < longDrift * 0.5 ? 'decelerating' : 'stable'
  };
}

export async function calculateHybridDrift(priceData, mlService) {
  const returns = [];
  const closes = priceData.map(p => p.close);
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }

  const statistical = calculateAdaptiveDrift(returns);
  const ml = mlService ? mlService.predict(priceData) : { drift: 0, confidence: 0 };
  const mlWeight = ml.confidence || 0;
  const statisticalWeight = 1 - mlWeight;
  const hybridDrift = ml.drift * mlWeight + statistical.adaptiveDrift * statisticalWeight;

  return {
    hybridDrift,
    components: { statistical, ml },
    weights: { ml: mlWeight, statistical: statisticalWeight },
    regime: statistical.regime
  };
}

export function detectRegimeWithDrift(prices, returns) {
  const baseRegime = detectRegime(prices); // Mevcut fonksiyon
  const driftInfo = calculateAdaptiveDrift(returns);

  return {
    ...baseRegime,
    drift: driftInfo,
    adjustedExpectation: (baseRegime.expectedReturn || 0) + driftInfo.adaptiveDrift,
    confidence: (baseRegime.confidence || 0.5) * (1 - Math.abs(driftInfo.trendStrength - 0.5) * 0.3)
  };
}

// Yardımcı: Mevcut detectRegime fonksiyonu (placeholder)
function detectRegime(prices) {
  const sma20 = prices.slice(-20).reduce((a, p) => a + p.close, 0) / 20;
  const sma50 = prices.slice(-50).reduce((a, p) => a + p.close, 0) / 50;
  return {
    expectedReturn: (sma20 - sma50) / sma50,
    confidence: 0.6
  };
}

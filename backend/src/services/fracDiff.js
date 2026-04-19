/**
 * Fractional Differentiation
 * Formül: X_t^(d) = Σ ω_k * X_{t-k}
 * Ağırlıklar: ω_k = -ω_{k-1} * (d-k+1) / k
 */
export function calcFracDiffWeights(d, threshold = 1e-5, kMax = 100) {
  const w = [1];
  for (let k = 1; k <= kMax; k++) {
    const wk = -w[k - 1] * ((d - k + 1) / k);
    if (Math.abs(wk) < threshold) break;
    w.push(wk);
  }
  return w;
}

/**
 * Fractional Differentiation uygula - d=0.4 varsayılan (optimal: hafıza + stasyonerlik)
 */
export function applyFracDiff(closes, d = 0.4, threshold = 1e-5) {
  const weights = calcFracDiffWeights(d, threshold);
  const k = weights.length;
  const result = [];
  for (let i = k - 1; i < closes.length; i++) {
    let val = 0;
    for (let j = 0; j < k; j++) {
      val += weights[j] * closes[i - j];
    }
    result.push(val);
  }
  return result;
}

/**
 * ADF test yaklaşımı - t-istatistiği hesapla
 * Gerçek ADF yok ama önce fark alma, sonra autocorrelation ile yaklaşım
 */
export function adfApprox(series) {
  if (series.length < 10) return { tStat: 0, isStationary: false };
  const diffs = series.slice(1).map((v, i) => v - series[i]);
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const variance = diffs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / diffs.length;
  const stdErr = Math.sqrt(variance / diffs.length);
  const tStat = stdErr > 0 ? mean / stdErr : 0;
  return { tStat, isStationary: Math.abs(tStat) > 2.58 };
}

/**
 * Optimal d tespiti - 0.1-0.9 arası tarar, p<0.05 olan minimum d'yi bulur
 * BIST verisi için genellikle d≈0.4 optimal çıkar
 */
export function findOptimalD(closes, threshold = 1e-5) {
  for (let d = 0.1; d <= 0.9; d += 0.1) {
    const diffed = applyFracDiff(closes, parseFloat(d.toFixed(1)), threshold);
    const { isStationary } = adfApprox(diffed);
    if (isStationary) {
      return { d: parseFloat(d.toFixed(2)), series: diffed, memoryRetained: Math.round((1 - d) * 100) };
    }
  }
  // Fallback
  return { d: 0.5, series: applyFracDiff(closes, 0.5), memoryRetained: 50 };
}

/**
 * OFI (Order Flow Imbalance) yaklaşımı
 * Gerçek order book olmadan: Alış hacmi = vol * (close>open), Satış = vol * (close<open)
 * Formül yorumu: ΔW_n > 0 = alış baskısı
 */
export function calcOFI(priceData) {
  if (priceData.length < 5) return { ofi: 0, status: 'veri yok', trend: 'nötr', score: 50, comment: 'Yeterli veri yok.' };
  
  const recent = priceData.slice(-10);
  let buyVol = 0, sellVol = 0;
  
  recent.forEach(bar => {
    const vol = bar.volume || 0;
    if (bar.close > bar.open) buyVol += vol;
    else if (bar.close < bar.open) sellVol += vol;
    else { buyVol += vol / 2; sellVol += vol / 2; }
  });
  
  const totalVol = buyVol + sellVol;
  const ofi = totalVol > 0 ? (buyVol - sellVol) / totalVol : 0;
  const ofiPct = parseFloat((ofi * 100).toFixed(1));
  
  // Fiyat son 5 gün yönü
  const priceUp = priceData[priceData.length - 1].close > priceData[priceData.length - 5].close;
  
  let status, score;
  if (ofi > 0.15 && priceUp) { status = 'Trend Onayı 📈'; score = 80; }
  else if (ofi < -0.15 && !priceUp) { status = 'Trend Onayı 📉'; score = 20; }
  else if (ofi > 0.10 && !priceUp) { status = 'Bullish Divj. 🔄'; score = 70; }
  else if (ofi < -0.10 && priceUp) { status = 'Bearish Divj. 🔄'; score = 35; }
  else { status = 'Nötr'; score = 50; }
  
  return { ofi: ofiPct, buyVol, sellVol, status, score,
    comment: `Alış baskısı %${(buyVol/totalVol*100).toFixed(0)}, Satış %${(sellVol/totalVol*100).toFixed(0)}. ${status}` };
}

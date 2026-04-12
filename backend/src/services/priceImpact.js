/**
 * FinansRadar — Fiyat Etki Analizi (Impact Breakdown)
 * ====================================================
 * Her indikatörün ve analiz yönteminin fiyata etkisini
 * hem yüzde (%) hem de para birimi (TL) olarak hesaplar.
 *
 * 3 Kategori:
 *   1. Risk Faktörleri: VaR, Volatilite, Kaldıraç, CDS
 *   2. Trend Faktörleri: RSI, MACD, SMA Cross, Bollinger, Hacim
 *   3. Tahmin Faktörleri: Monte Carlo (1H/1A/1Y), Temel Analiz (F/K)
 *
 * Çıktı: Fair Value + TL/% etki + yön + açıklama
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. RİSK FAKTÖRLERİ (VaR, Volatilite, Kaldıraç, CDS)
// ═══════════════════════════════════════════════════════════════════════════

function calcRiskImpact(currentPrice, { var95, annualSigma, kaldirac, nfbFavok, cds, vix }) {
  const factors = [];
  let totalTL = 0;

  // 1.1 VaR Etkisi
  const varVal = var95 != null ? var95 / 100 : -0.03; // yüzde → oran
  const varImpactPct = varVal * 0.35;
  const varImpactTL = currentPrice * varImpactPct;
  factors.push({
    name: 'VaR (95%)',
    indicator: 'var_95',
    value: var95 != null ? `%${var95.toFixed(2)}` : '—',
    weight: '%35',
    impactPct: parseFloat((varImpactPct * 100).toFixed(2)),
    impactTL: parseFloat(varImpactTL.toFixed(2)),
    direction: varImpactTL < 0 ? 'NEGATİF' : 'POZİTİF',
    explanation: `Günlük maksimum kayıp riski %${Math.abs(var95 || 3).toFixed(1)}. Bu risk fiyatı ${Math.abs(varImpactTL).toFixed(2)} TL ${varImpactTL < 0 ? 'aşağı çekiyor' : 'etkiliyor'}.`,
    color: varImpactTL < 0 ? '#DC2626' : '#22C55E',
  });
  totalTL += varImpactTL;

  // 1.2 Volatilite Etkisi
  const volVal = annualSigma != null ? annualSigma / 100 : 0.25;
  const volIdeal = 0.20;
  const volImpactPct = (volVal - volIdeal) * (-0.25);
  const volImpactTL = currentPrice * volImpactPct;
  factors.push({
    name: 'Volatilite (Yıllık)',
    indicator: 'volatility',
    value: annualSigma != null ? `%${annualSigma.toFixed(1)}` : '—',
    weight: '%25',
    impactPct: parseFloat((volImpactPct * 100).toFixed(2)),
    impactTL: parseFloat(volImpactTL.toFixed(2)),
    direction: volImpactTL < 0 ? 'NEGATİF' : 'POZİTİF',
    explanation: `Yıllık oynaklık %${(volVal * 100).toFixed(1)}. İdeal %20. ${volImpactTL < 0 ? `Fazla oynaklık fiyatı ${Math.abs(volImpactTL).toFixed(2)} TL baskılıyor.` : `Düşük oynaklık ${Math.abs(volImpactTL).toFixed(2)} TL destek sağlıyor.`}`,
    color: volImpactTL < 0 ? '#DC2626' : '#22C55E',
  });
  totalTL += volImpactTL;

  // 1.3 Kaldıraç Etkisi
  const kalVal = kaldirac != null ? kaldirac : 2.5;
  let kalImpactPct;
  if (kalVal > 4.0) kalImpactPct = -0.08;
  else if (kalVal > 3.0) kalImpactPct = -0.04;
  else if (kalVal > 2.0) kalImpactPct = -0.015;
  else if (kalVal > 1.5) kalImpactPct = 0.01;
  else kalImpactPct = 0.03;

  const kalImpactTL = currentPrice * kalImpactPct;
  factors.push({
    name: 'Kaldıraç Oranı',
    indicator: 'kaldirac',
    value: kaldirac != null ? `${kaldirac.toFixed(2)}x` : '—',
    weight: '%20',
    impactPct: parseFloat((kalImpactPct * 100).toFixed(2)),
    impactTL: parseFloat(kalImpactTL.toFixed(2)),
    direction: kalImpactTL < 0 ? 'NEGATİF' : 'POZİTİF',
    explanation: `Borç/Özkaynak ${kalVal.toFixed(2)}x. ${kalVal > 3 ? 'Yüksek borç riski' : kalVal > 2 ? 'Orta kaldıraç' : 'Konservatif yapı'}. Etki: ${kalImpactTL >= 0 ? '+' : ''}${kalImpactTL.toFixed(2)} TL`,
    color: kalImpactTL < 0 ? '#DC2626' : '#22C55E',
  });
  totalTL += kalImpactTL;

  // 1.4 CDS Etkisi
  const cdsVal = cds || 250;
  const cdsBaseline = 250;
  const cdsDiff = (cdsVal - cdsBaseline) / cdsBaseline;
  const cdsImpactPct = -cdsDiff * 0.15;
  const cdsImpactTL = currentPrice * cdsImpactPct;
  factors.push({
    name: 'CDS (5Y Kredi Riski)',
    indicator: 'cds',
    value: `${cdsVal} bps`,
    weight: '%10',
    impactPct: parseFloat((cdsImpactPct * 100).toFixed(2)),
    impactTL: parseFloat(cdsImpactTL.toFixed(2)),
    direction: cdsImpactTL < 0 ? 'NEGATİF' : 'POZİTİF',
    explanation: `Ülke risk primi ${cdsVal} bps (Normal: 250). ${cdsVal > 250 ? `Artış fiyatı ${Math.abs(cdsImpactTL).toFixed(2)} TL düşürüyor.` : `Düşük CDS ${Math.abs(cdsImpactTL).toFixed(2)} TL destek.`}`,
    color: cdsImpactTL < 0 ? '#DC2626' : '#22C55E',
  });
  totalTL += cdsImpactTL;

  // 1.5 VIX Etkisi
  const vixVal = vix || 20;
  const vixBaseline = 20;
  const vixDiff = (vixVal - vixBaseline) / vixBaseline;
  const vixImpactPct = -vixDiff * 0.10;
  const vixImpactTL = currentPrice * vixImpactPct;
  factors.push({
    name: 'VIX (Korku Endeksi)',
    indicator: 'vix',
    value: `${vixVal.toFixed(1)}`,
    weight: '%10',
    impactPct: parseFloat((vixImpactPct * 100).toFixed(2)),
    impactTL: parseFloat(vixImpactTL.toFixed(2)),
    direction: vixImpactTL < 0 ? 'NEGATİF' : 'POZİTİF',
    explanation: `VIX ${vixVal.toFixed(1)} (Normal: 20). ${vixVal > 25 ? 'Küresel korku yüksek.' : vixVal < 18 ? 'Piyasa sakin.' : 'Normal aralıkta.'}`,
    color: vixImpactTL < 0 ? '#DC2626' : '#22C55E',
  });
  totalTL += vixImpactTL;

  return {
    category: 'RİSK FAKTÖRLERİ',
    icon: '🔴',
    totalTL: parseFloat(totalTL.toFixed(2)),
    totalPct: parseFloat(((totalTL / currentPrice) * 100).toFixed(2)),
    factors,
    summary: `Riskler toplamda fiyatı ${totalTL >= 0 ? '+' : ''}${totalTL.toFixed(2)} TL (${((totalTL / currentPrice) * 100).toFixed(2)}%) etkiliyor.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. TREND FAKTÖRLERİ (RSI, MACD, SMA Cross, Bollinger, Hacim)
// ═══════════════════════════════════════════════════════════════════════════

function calcTrendImpact(currentPrice, indicators) {
  const factors = [];
  let totalTL = 0;

  // 2.1 RSI Etkisi
  const rsiRaw = indicators.rsi?.raw;
  let rsiImpactPct;
  if (rsiRaw != null) {
    if (rsiRaw < 25) rsiImpactPct = 0.06;
    else if (rsiRaw < 35) rsiImpactPct = 0.03;
    else if (rsiRaw < 50) rsiImpactPct = 0.01;
    else if (rsiRaw < 65) rsiImpactPct = -0.005;
    else if (rsiRaw < 75) rsiImpactPct = -0.03;
    else rsiImpactPct = -0.06;
  } else rsiImpactPct = 0;

  const rsiTL = currentPrice * rsiImpactPct;
  factors.push({
    name: 'RSI (14)',
    indicator: 'rsi',
    value: rsiRaw != null ? rsiRaw.toFixed(1) : '—',
    weight: '%25',
    impactPct: parseFloat((rsiImpactPct * 100).toFixed(2)),
    impactTL: parseFloat(rsiTL.toFixed(2)),
    direction: rsiTL >= 0 ? 'POZİTİF' : 'NEGATİF',
    explanation: rsiRaw != null
      ? `RSI ${rsiRaw.toFixed(1)}. ${rsiRaw < 30 ? 'Aşırı satış bölgesi → tepki yükselişi bekleniyor' : rsiRaw > 70 ? 'Aşırı alım → düzeltme riski var' : 'Nötr bölgede'}. Etki: ${rsiTL >= 0 ? '+' : ''}${rsiTL.toFixed(2)} TL`
      : 'Veri yok.',
    color: rsiTL >= 0 ? '#22C55E' : '#DC2626',
  });
  totalTL += rsiTL;

  // 2.2 MACD Etkisi
  const macdData = indicators.macd?.raw;
  let macdImpactPct = 0;
  if (macdData) {
    const hist = macdData.hist || 0;
    const line = macdData.macd || 0;
    if (hist > 0 && line > 0) macdImpactPct = 0.04;
    else if (hist > 0 && line < 0) macdImpactPct = 0.025;
    else if (hist < 0 && line > 0) macdImpactPct = -0.015;
    else if (hist < 0 && line < 0) macdImpactPct = -0.035;
    else macdImpactPct = 0;
  }

  const macdTL = currentPrice * macdImpactPct;
  factors.push({
    name: 'MACD Histogram',
    indicator: 'macd',
    value: macdData?.hist != null ? macdData.hist.toFixed(2) : '—',
    weight: '%25',
    impactPct: parseFloat((macdImpactPct * 100).toFixed(2)),
    impactTL: parseFloat(macdTL.toFixed(2)),
    direction: macdTL >= 0 ? 'POZİTİF' : 'NEGATİF',
    explanation: macdData
      ? `MACD ${macdData.macd?.toFixed(2) || '—'}, Histogram: ${macdData.hist?.toFixed(2) || '—'}. ${macdImpactPct > 0 ? 'Yukarı momentum aktif' : 'Aşağı momentum'}. Etki: ${macdTL >= 0 ? '+' : ''}${macdTL.toFixed(2)} TL`
      : 'Veri yok.',
    color: macdTL >= 0 ? '#22C55E' : '#DC2626',
  });
  totalTL += macdTL;

  // 2.3 SMA Golden/Death Cross Etkisi
  const smaData = indicators.sma?.raw;
  let smaImpactPct = 0;
  if (smaData && smaData.sma20 && smaData.sma50) {
    const golden = smaData.sma20 > smaData.sma50;
    const priceAboveSma20 = currentPrice > smaData.sma20;
    if (golden && priceAboveSma20) smaImpactPct = 0.04;
    else if (golden) smaImpactPct = 0.015;
    else if (!golden && !priceAboveSma20) smaImpactPct = -0.04;
    else smaImpactPct = -0.015;
  }

  const smaTL = currentPrice * smaImpactPct;
  factors.push({
    name: 'SMA Cross (20/50)',
    indicator: 'sma_cross',
    value: smaData ? (smaData.sma20 > smaData.sma50 ? 'GOLDEN ✓' : 'DEATH ✗') : '—',
    weight: '%20',
    impactPct: parseFloat((smaImpactPct * 100).toFixed(2)),
    impactTL: parseFloat(smaTL.toFixed(2)),
    direction: smaTL >= 0 ? 'POZİTİF' : 'NEGATİF',
    explanation: smaData
      ? `SMA20: ${smaData.sma20?.toFixed(2)} | SMA50: ${smaData.sma50?.toFixed(2)}. ${smaImpactPct > 0 ? 'Golden Cross → yükseliş trendi destekli' : 'Death Cross → düşüş baskısı'}. Etki: ${smaTL >= 0 ? '+' : ''}${smaTL.toFixed(2)} TL`
      : 'Veri yok.',
    color: smaTL >= 0 ? '#22C55E' : '#DC2626',
  });
  totalTL += smaTL;

  // 2.4 Bollinger Etkisi
  const bollData = indicators.bollinger?.raw;
  let bollImpactPct = 0;
  if (bollData) {
    const position = (currentPrice - bollData.lower) / (bollData.upper - bollData.lower);
    if (position <= 0.1) bollImpactPct = 0.05;
    else if (position <= 0.25) bollImpactPct = 0.025;
    else if (position >= 0.9) bollImpactPct = -0.04;
    else if (position >= 0.75) bollImpactPct = -0.02;
    else bollImpactPct = 0;
  }

  const bollTL = currentPrice * bollImpactPct;
  factors.push({
    name: 'Bollinger Bantları',
    indicator: 'bollinger',
    value: bollData ? `Orta: ${bollData.middle?.toFixed(1)}` : '—',
    weight: '%15',
    impactPct: parseFloat((bollImpactPct * 100).toFixed(2)),
    impactTL: parseFloat(bollTL.toFixed(2)),
    direction: bollTL >= 0 ? 'POZİTİF' : 'NEGATİF',
    explanation: bollData
      ? `Alt: ${bollData.lower?.toFixed(2)} | Üst: ${bollData.upper?.toFixed(2)}. ${bollImpactPct > 0 ? 'Alt bant yakını → geri dönüş beklentisi' : bollImpactPct < 0 ? 'Üst bant aşımı → düzeltme riski' : 'Orta bölgede'}. Etki: ${bollTL >= 0 ? '+' : ''}${bollTL.toFixed(2)} TL`
      : 'Veri yok.',
    color: bollTL >= 0 ? '#22C55E' : '#DC2626',
  });
  totalTL += bollTL;

  // 2.5 Hacim Etkisi
  const volScore = indicators.volume?.score || 50;
  let hacimImpactPct;
  if (volScore >= 75) hacimImpactPct = 0.025;
  else if (volScore >= 60) hacimImpactPct = 0.01;
  else if (volScore <= 35) hacimImpactPct = -0.02;
  else hacimImpactPct = 0;

  const hacimTL = currentPrice * hacimImpactPct;
  factors.push({
    name: 'Hacim Analizi',
    indicator: 'hacim',
    value: indicators.volume?.status || '—',
    weight: '%15',
    impactPct: parseFloat((hacimImpactPct * 100).toFixed(2)),
    impactTL: parseFloat(hacimTL.toFixed(2)),
    direction: hacimTL >= 0 ? 'POZİTİF' : 'NEGATİF',
    explanation: `Hacim durumu: ${indicators.volume?.status || '—'}. ${hacimImpactPct > 0 ? 'Artan hacim trendi destekliyor' : hacimImpactPct < 0 ? 'Düşük hacim dikkat çekiyor' : 'Normal hacim'}. Etki: ${hacimTL >= 0 ? '+' : ''}${hacimTL.toFixed(2)} TL`,
    color: hacimTL >= 0 ? '#22C55E' : '#DC2626',
  });
  totalTL += hacimTL;

  return {
    category: 'TREND FAKTÖRLERİ',
    icon: '📈',
    totalTL: parseFloat(totalTL.toFixed(2)),
    totalPct: parseFloat(((totalTL / currentPrice) * 100).toFixed(2)),
    factors,
    summary: `Trend göstergeleri fiyatı ${totalTL >= 0 ? '+' : ''}${totalTL.toFixed(2)} TL (${((totalTL / currentPrice) * 100).toFixed(2)}%) etkiliyor.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. TAHMİN FAKTÖRLERİ (Monte Carlo, Temel Analiz)
// ═══════════════════════════════════════════════════════════════════════════

function calcPredictionImpact(currentPrice, predictions, fundamentalScore, fk) {
  const factors = [];
  let totalTL = 0;

  // 3.1 Monte Carlo Kısa Vade (1 Hafta)
  const weeklyTarget = predictions?.weekly?.target;
  if (weeklyTarget != null) {
    const diff = (weeklyTarget - currentPrice) / currentPrice;
    const impactPct = diff * 0.25;
    const impactTL = currentPrice * impactPct;
    factors.push({
      name: 'Monte Carlo (1 Hafta)',
      indicator: 'mc_weekly',
      value: `${weeklyTarget.toFixed(2)} TL`,
      weight: '%25',
      impactPct: parseFloat((impactPct * 100).toFixed(2)),
      impactTL: parseFloat(impactTL.toFixed(2)),
      direction: impactTL >= 0 ? 'POZİTİF' : 'NEGATİF',
      explanation: `1000 Monte Carlo simülasyonu medyan hedef: ${weeklyTarget.toFixed(2)} TL (${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(1)}%). Etki: ${impactTL >= 0 ? '+' : ''}${impactTL.toFixed(2)} TL`,
      color: impactTL >= 0 ? '#22C55E' : '#DC2626',
    });
    totalTL += impactTL;
  }

  // 3.2 Monte Carlo Orta Vade (3 Ay)
  const monthlyTarget = predictions?.monthly?.target;
  if (monthlyTarget != null) {
    const diff = (monthlyTarget - currentPrice) / currentPrice;
    const impactPct = diff * 0.25;
    const impactTL = currentPrice * impactPct;
    factors.push({
      name: 'Trend + Mevsimsel (3 Ay)',
      indicator: 'mc_monthly',
      value: `${monthlyTarget.toFixed(2)} TL`,
      weight: '%25',
      impactPct: parseFloat((impactPct * 100).toFixed(2)),
      impactTL: parseFloat(impactTL.toFixed(2)),
      direction: impactTL >= 0 ? 'POZİTİF' : 'NEGATİF',
      explanation: `2000 simülasyon + trend analizi medyan hedef: ${monthlyTarget.toFixed(2)} TL. Etki: ${impactTL >= 0 ? '+' : ''}${impactTL.toFixed(2)} TL`,
      color: impactTL >= 0 ? '#22C55E' : '#DC2626',
    });
    totalTL += impactTL;
  }

  // 3.3 GBM Monte Carlo (1 Yıl)
  const yearlyTarget = predictions?.yearly?.target;
  if (yearlyTarget != null) {
    const diff = (yearlyTarget - currentPrice) / currentPrice;
    const impactPct = diff * 0.25;
    const impactTL = currentPrice * impactPct;
    factors.push({
      name: 'GBM Monte Carlo (1 Yıl)',
      indicator: 'mc_yearly',
      value: `${yearlyTarget.toFixed(2)} TL`,
      weight: '%25',
      impactPct: parseFloat((impactPct * 100).toFixed(2)),
      impactTL: parseFloat(impactTL.toFixed(2)),
      direction: impactTL >= 0 ? 'POZİTİF' : 'NEGATİF',
      explanation: `GBM 3000 simülasyon medyan: ${yearlyTarget.toFixed(2)} TL. Uzun vade büyüme potansiyeli. Etki: ${impactTL >= 0 ? '+' : ''}${impactTL.toFixed(2)} TL`,
      color: impactTL >= 0 ? '#22C55E' : '#DC2626',
    });
    totalTL += impactTL;
  }

  // 3.4 Temel Analiz Skoru → F/K Bazlı Hedef
  const fundScore = fundamentalScore || 50;
  const fundDeviation = (fundScore - 50) / 50; // -1 to +1
  const fundImpactPct = fundDeviation * 0.08;
  const fundImpactTL = currentPrice * fundImpactPct;
  
  // F/K bazlı hedef fiyat tahmini
  let fkTarget = null;
  if (fk != null && fk > 0) {
    // Sektör ortalaması F/K varsayımı
    const sectorAvgFK = fk > 30 ? fk * 0.7 : fk > 15 ? fk * 0.8 : fk * 1.2;
    fkTarget = currentPrice * (sectorAvgFK / fk);
  }

  factors.push({
    name: 'Temel Analiz (F/K)',
    indicator: 'fundamental',
    value: fk != null ? `F/K: ${fk.toFixed(1)}` : `Skor: ${fundScore}`,
    weight: '%25',
    impactPct: parseFloat((fundImpactPct * 100).toFixed(2)),
    impactTL: parseFloat(fundImpactTL.toFixed(2)),
    direction: fundImpactTL >= 0 ? 'POZİTİF' : 'NEGATİF',
    explanation: `Temel analiz skoru ${fundScore}/100. ${fundScore >= 70 ? 'Güçlü bilanço, değerleme desteği var' : fundScore >= 50 ? 'Ortalama temel kalite' : 'Zayıf temel veriler'}. Etki: ${fundImpactTL >= 0 ? '+' : ''}${fundImpactTL.toFixed(2)} TL`,
    color: fundImpactTL >= 0 ? '#22C55E' : '#DC2626',
    fkTarget: fkTarget != null ? parseFloat(fkTarget.toFixed(2)) : null,
  });
  totalTL += fundImpactTL;

  return {
    category: 'TAHMİN FAKTÖRLERİ',
    icon: '🔮',
    totalTL: parseFloat(totalTL.toFixed(2)),
    totalPct: parseFloat(((totalTL / currentPrice) * 100).toFixed(2)),
    factors,
    summary: `Tahmin modelleri fiyatı ${totalTL >= 0 ? '+' : ''}${totalTL.toFixed(2)} TL (${((totalTL / currentPrice) * 100).toFixed(2)}%) ${totalTL >= 0 ? 'yukarı çekiyor' : 'aşağı baskılıyor'}.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANA FONKSİYON: Tam Fiyat Etki Analizi
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Her faktörün fiyata TL ve % etkisini hesapla
 * @returns {Object} fairValue, totalImpact, 3 kategori breakdown
 */
export function calculatePriceImpact({
  currentPrice,
  // Risk params
  var95 = null,
  annualSigma = null,
  kaldirac = null,
  nfbFavok = null,
  cds = null,
  vix = null,
  // Indicators (teknik)
  indicators = {},
  // Predictions
  predictions = null,
  fundamentalScore = 50,
  fk = null,
}) {
  const risk = calcRiskImpact(currentPrice, { var95, annualSigma, kaldirac, nfbFavok, cds, vix });
  const trend = calcTrendImpact(currentPrice, indicators);
  const prediction = calcPredictionImpact(currentPrice, predictions, fundamentalScore, fk);

  const totalImpactTL = parseFloat((risk.totalTL + trend.totalTL + prediction.totalTL).toFixed(2));
  const totalImpactPct = parseFloat(((totalImpactTL / currentPrice) * 100).toFixed(2));
  const fairValue = parseFloat((currentPrice + totalImpactTL).toFixed(2));

  // En etkileyici faktörler (sıralı)
  const allFactors = [...risk.factors, ...trend.factors, ...prediction.factors];
  const sorted = [...allFactors].sort((a, b) => Math.abs(b.impactTL) - Math.abs(a.impactTL));

  return {
    currentPrice,
    fairValue,
    totalImpactTL,
    totalImpactPct,
    direction: totalImpactTL >= 0 ? 'YUKARI' : 'AŞAĞI',
    categories: [risk, trend, prediction],
    topPositive: sorted.filter(f => f.impactTL > 0).slice(0, 3),
    topNegative: sorted.filter(f => f.impactTL < 0).slice(0, 3),
    allFactorsSorted: sorted,
  };
}

/**
 * FinansRadar PPTX Şirket Sağlamlık & Büyüme Analizi
 * ====================================================
 * 1. Robustness Score (Sağlamlık): Cari Oran, Kaldıraç, Net Marj, NFB/FAVÖK
 * 2. Growth Score (Büyüme): Satış, FAVÖK, Kâr, Özkaynak büyümesi
 * 3. Combined Fundamental Score: Sağlamlık×0.6 + Büyüme×0.4
 * 4. Sector Benchmarking (BIST sektör ortalamaları)
 */

// ─── BIST Sektör Ortalamaları (yaklaşık) ──────────────────────────────────────
const SECTOR_AVERAGES = {
  'Bankacılık':    { currentRatio: 1.1, leverage: 8.0, netMargin: 22, nfbToEbitda: null, fk: 7,  pddd: 0.9 },
  'Holding':       { currentRatio: 1.5, leverage: 2.5, netMargin: 15, nfbToEbitda: 2.5,  fk: 8,  pddd: 0.8 },
  'Sanayi':        { currentRatio: 1.6, leverage: 2.8, netMargin: 10, nfbToEbitda: 2.8,  fk: 12, pddd: 1.5 },
  'Enerji':        { currentRatio: 1.4, leverage: 3.2, netMargin: 12, nfbToEbitda: 3.5,  fk: 10, pddd: 1.2 },
  'Teknoloji':     { currentRatio: 2.2, leverage: 1.8, netMargin: 18, nfbToEbitda: 1.5,  fk: 20, pddd: 3.0 },
  'Perakende':     { currentRatio: 1.2, leverage: 3.5, netMargin: 4,  nfbToEbitda: 3.8,  fk: 15, pddd: 2.0 },
  'Havacılık':     { currentRatio: 0.9, leverage: 4.0, netMargin: 8,  nfbToEbitda: 4.0,  fk: 9,  pddd: 1.1 },
  'Savunma':       { currentRatio: 1.8, leverage: 2.2, netMargin: 14, nfbToEbitda: 1.8,  fk: 14, pddd: 2.5 },
  'Unknown':       { currentRatio: 1.5, leverage: 2.5, netMargin: 10, nfbToEbitda: 2.5,  fk: 10, pddd: 1.5 },
};

// ─── KADEME 1: SAĞLAMLIK SKORU ────────────────────────────────────────────────

/**
 * Cari Oran değerlendirmesi — 0-25 puan
 */
function scoreCariOran(value) {
  if (value === null || value === undefined) return { points: 12, status: 'Veri Yok', level: 'gray', hint: 'Cari oran verisi mevcut değil.' };
  if (value >= 2.0) return { points: 25, status: 'Mükemmel', level: 'green', hint: `${value.toFixed(2)} ≥ 2.0 — Likidite güçlü, krizlere dayanıklı.` };
  if (value >= 1.5) return { points: 15, status: 'Yeterli', level: 'cyan', hint: `${value.toFixed(2)} — Normal likidite seviyesi.` };
  if (value >= 1.0) return { points: 5, status: 'Riskli', level: 'yellow', hint: `${value.toFixed(2)} — Sıkışma riski var, borçlar varlıkları zorlayabilir.` };
  return { points: 0, status: 'Kritik', level: 'red', hint: `${value.toFixed(2)} < 1.0 — Likidite krizi olasılığı yüksek!` };
}

/**
 * Kaldıraç değerlendirmesi — 0-25 puan (ters orantılı)
 */
function scoreKaldirac(value) {
  if (value === null || value === undefined) return { points: 12, status: 'Veri Yok', level: 'gray', hint: 'Kaldıraç verisi mevcut değil.' };
  if (value <= 2.0) return { points: 25, status: 'Konservatif', level: 'green', hint: `${value.toFixed(2)} ≤ 2.0 — Düşük kaldıraç, güçlü özkaynak yapısı.` };
  if (value <= 3.0) return { points: 15, status: 'Dengeli', level: 'cyan', hint: `${value.toFixed(2)} — Optimal kaldıraç, normal finansman yapısı.` };
  if (value <= 4.0) return { points: 5, status: 'Yüksek Risk', level: 'yellow', hint: `${value.toFixed(2)} — Aşırı borçlanma başlangıcı, dikkat!` };
  return { points: 0, status: 'Tehlikeli', level: 'red', hint: `${value.toFixed(2)} > 4.0 — İflas riski yüksek!` };
}

/**
 * Net Marj değerlendirmesi — 0-25 puan
 */
function scoreNetMarj(value) {
  if (value === null || value === undefined) return { points: 12, status: 'Veri Yok', level: 'gray', hint: 'Net marj verisi mevcut değil.' };
  if (value >= 15) return { points: 25, status: 'Yüksek Karlılık', level: 'green', hint: `%${value.toFixed(1)} marj — Premium karlılık seviyesi.` };
  if (value >= 10) return { points: 15, status: 'Karlı', level: 'cyan', hint: `%${value.toFixed(1)} marj — Sağlıklı karlılık.` };
  if (value >= 5)  return { points: 5,  status: 'Düşük Karlılık', level: 'yellow', hint: `%${value.toFixed(1)} marj — Geliştirme gerekli.` };
  return { points: 0, status: 'Zarar Riski', level: 'red', hint: `%${value.toFixed(1)} marj — Düşük/negatif karlılık. Risk yüksek.` };
}

/**
 * NFB/FAVÖK değerlendirmesi — 0-25 puan (ters orantılı)
 */
function scoreNfbFavok(value) {
  if (value === null || value === undefined) return { points: 12, status: 'Veri Yok', level: 'gray', hint: 'NFB/FAVÖK verisi mevcut değil.' };
  if (value <= 2.0) return { points: 25, status: 'Güçlü Borç Kapasitesi', level: 'green', hint: `${value.toFixed(2)}x — Borç 2 yılda ödenebilir. Mükemmel.` };
  if (value <= 3.0) return { points: 15, status: 'Yeterli', level: 'cyan', hint: `${value.toFixed(2)}x — Kabul edilebilir borç seviyesi.` };
  if (value <= 4.0) return { points: 5, status: 'Yüksek Borç Yükü', level: 'yellow', hint: `${value.toFixed(2)}x — 4 yıl borç geri ödeme süresi. Riskli.` };
  return { points: 0, status: 'Borç Servisi Yetersiz', level: 'red', hint: `${value.toFixed(2)}x > 4.0 — Şirket borcunu karşılamakta zorlanıyor!` };
}

/**
 * Asit Test yorumu (puan yok, ek bilgi)
 */
function interpretAcidTest(currentRatio, acidTest) {
  if (!acidTest || !currentRatio) return null;
  const diff = currentRatio - acidTest;
  if (diff > 0.5) return `⚠️ Cari Oran-Asit Test farkı ${diff.toFixed(2)} — Stok yükü ağır, likidite kalitesi düşük.`;
  return `✅ Cari Oran-Asit Test farkı ${diff.toFixed(2)} — Stok yükü makul, likidite kaliteli.`;
}

/**
 * Sağlamlık Skoru hesapla (PPTX Formülü — 0-100)
 */
export function calculateRobustnessScore(ratios) {
  const cariResult = scoreCariOran(ratios?.currentRatio);
  const kaldiracResult = scoreKaldirac(ratios?.leverage);
  const marjResult = scoreNetMarj(ratios?.netMargin);
  const nfbResult = scoreNfbFavok(ratios?.nfbToEbitda);
  const acidInfo = interpretAcidTest(ratios?.currentRatio, ratios?.acidTest);

  const totalScore = cariResult.points + kaldiracResult.points + marjResult.points + nfbResult.points;

  let grade, riskLevel;
  if (totalScore >= 80) { grade = 'A'; riskLevel = 'Düşük Risk'; }
  else if (totalScore >= 60) { grade = 'B'; riskLevel = 'Orta Risk'; }
  else if (totalScore >= 40) { grade = 'C'; riskLevel = 'Yüksek Risk'; }
  else { grade = 'D'; riskLevel = 'Kritik Risk'; }

  return {
    totalScore,
    grade,
    riskLevel,
    components: {
      cariOran: { label: 'Cari Oran', value: ratios?.currentRatio, ...cariResult, weight: '%25' },
      kaldirac: { label: 'Kaldıraç', value: ratios?.leverage, ...kaldiracResult, weight: '%25' },
      netMarj: { label: 'Net Marj', value: ratios?.netMargin, ...marjResult, weight: '%25' },
      nfbFavok: { label: 'NFB/FAVÖK', value: ratios?.nfbToEbitda, ...nfbResult, weight: '%25' },
    },
    acidTestNote: acidInfo,
  };
}

// ─── KADEME 2: BÜYÜME SKORU ───────────────────────────────────────────────────

function scoreGrowth(value, thresholds, labels) {
  if (value === null || value === undefined) return { points: 0, status: 'Veri Yok', level: 'gray', hint: 'Büyüme hesabı için 2 dönem verisi gerekli.' };
  const [t1, t2, t3] = thresholds;
  const [s1, s2, s3, s4] = labels;
  if (value >= t1) return { points: 25, status: s1, level: 'green', hint: `+%${value.toFixed(1)} büyüme — ${s1}` };
  if (value >= t2) return { points: 20, status: s2, level: 'cyan', hint: `+%${value.toFixed(1)} büyüme — ${s2}` };
  if (value >= t3) return { points: 10, status: s3, level: 'yellow', hint: `%${value.toFixed(1)} büyüme — ${s3}` };
  return { points: 0, status: s4, level: value >= 0 ? 'yellow' : 'red', hint: `%${value.toFixed(1)} — ${s4}` };
}

/**
 * İki dönem FundamentalData'dan büyüme oranı hesapla
 */
function calcGrowthPct(current, previous) {
  if (!previous || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Büyüme Skoru hesapla (PPTX Formülü — 0-100)
 */
export function calculateGrowthScore(currentFund, previousFund) {
  if (!currentFund) {
    return { totalScore: 0, growthGrade: 'LOW', cagr: 0, components: {}, noData: true };
  }

  const salesGrowth = previousFund ? calcGrowthPct(currentFund.netSales, previousFund.netSales) : null;
  const ebitdaGrowth = (previousFund && currentFund.ebitda && previousFund.ebitda)
    ? calcGrowthPct(currentFund.ebitda, previousFund.ebitda) : null;
  const profitGrowth = (previousFund && currentFund.netProfit && previousFund.netProfit)
    ? calcGrowthPct(currentFund.netProfit, previousFund.netProfit) : null;
  const equityGrowth = previousFund ? calcGrowthPct(currentFund.equity, previousFund.equity) : null;

  const salesResult  = scoreGrowth(salesGrowth,  [20, 10, 5],  ['Patlama 🚀', 'Güçlü', 'Orta', 'Durgun/Düşen']);
  const ebitdaResult = scoreGrowth(ebitdaGrowth, [25, 15, 5],  ['Olağanüstü ✨', 'Güçlü', 'Stabil', 'Küçülüyor']);
  const profitResult = scoreGrowth(profitGrowth, [30, 15, 5],  ['Yüksek Büyüme 🏆', 'Büyüyor', 'Yavaş', 'Azalıyor']);
  const equityResult = scoreGrowth(equityGrowth, [15, 10, 5],  ['Güçlü Özkaynak 💪', 'Sağlıklı', 'Stabil', 'Eriyor']);

  const totalScore = salesResult.points + ebitdaResult.points + profitResult.points + equityResult.points;

  let growthGrade;
  if (totalScore >= 90) growthGrade = 'STAR ⭐';
  else if (totalScore >= 70) growthGrade = 'HIGH';
  else if (totalScore >= 50) growthGrade = 'MODERATE';
  else growthGrade = 'LOW';

  return {
    totalScore,
    growthGrade,
    cagr: parseFloat((totalScore / 10).toFixed(1)),
    components: {
      satisGrowth: { label: 'Satış Büyümesi', value: salesGrowth, ...salesResult, weight: '%25' },
      ebitdaGrowth: { label: 'FAVÖK Büyümesi', value: ebitdaGrowth, ...ebitdaResult, weight: '%25' },
      profitGrowth: { label: 'Net Kâr Büyümesi', value: profitGrowth, ...profitResult, weight: '%25' },
      equityGrowth: { label: 'Özkaynak Büyümesi', value: equityGrowth, ...equityResult, weight: '%25' },
    },
  };
}

// ─── KADEME 3: BİRLEŞİK TEMEL SKOR ──────────────────────────────────────────

/**
 * PPTX Final Formülü: Temel Skor = Sağlamlık×0.6 + Büyüme×0.4
 * Kriz rejiminde: Sağlamlık×0.8 + Büyüme×0.2
 */
export function calculateFundamentalScore(robustness, growth, regime = 'calm') {
  const isCalm = regime === 'calm';
  const [wR, wG] = isCalm ? [0.60, 0.40] : [0.80, 0.20];

  const score = Math.round(robustness.totalScore * wR + growth.totalScore * wG);

  let recommendation, recommendationTR, grade;
  if (score >= 80) { recommendation = 'STRONG_BUY'; recommendationTR = 'GÜÇLÜ AL'; grade = 'A'; }
  else if (score >= 65) { recommendation = 'BUY'; recommendationTR = 'AL'; grade = 'B+'; }
  else if (score >= 50) { recommendation = 'HOLD'; recommendationTR = 'TUT'; grade = 'B'; }
  else if (score >= 35) { recommendation = 'REDUCE'; recommendationTR = 'AZALT'; grade = 'C'; }
  else { recommendation = 'SELL'; recommendationTR = 'SAT'; grade = 'D'; }

  return {
    score,
    grade,
    recommendation,
    recommendationTR,
    weights: { robustness: wR, growth: wG },
    robustness,
    growth,
  };
}

// ─── KADEME 4: SEKTÖREL KARŞILAŞTIRMA ────────────────────────────────────────

export function sectorComparison(ratios, sector = 'Unknown') {
  const avg = SECTOR_AVERAGES[sector] || SECTOR_AVERAGES['Unknown'];
  const metrics = [
    { key: 'currentRatio', label: 'Cari Oran', higherBetter: true, value: ratios?.currentRatio, avg: avg.currentRatio },
    { key: 'leverage', label: 'Kaldıraç', higherBetter: false, value: ratios?.leverage, avg: avg.leverage },
    { key: 'netMargin', label: 'Net Marj %', higherBetter: true, value: ratios?.netMargin, avg: avg.netMargin },
    { key: 'nfbToEbitda', label: 'NFB/FAVÖK', higherBetter: false, value: ratios?.nfbToEbitda, avg: avg.nfbToEbitda },
    { key: 'fk', label: 'F/K', higherBetter: false, value: ratios?.fk, avg: avg.fk },
    { key: 'pddd', label: 'PD/DD', higherBetter: false, value: ratios?.pddd, avg: avg.pddd },
  ].filter(m => m.value !== null && m.value !== undefined && m.avg !== null);

  const results = metrics.map(m => {
    const diff = m.value - m.avg;
    const diffPct = (diff / m.avg) * 100;
    const better = m.higherBetter ? diff > 0 : diff < 0;
    return {
      key: m.key, label: m.label, value: m.value, avg: m.avg,
      diffPct: parseFloat(diffPct.toFixed(1)),
      status: Math.abs(diffPct) < 5 ? 'Eşit' : better ? 'Sektör Üstü ✅' : 'Sektör Altı ⚠️',
      better,
    };
  });

  const betterCount = results.filter(r => r.better).length;
  const sectorRank = results.length > 0 ? Math.round((betterCount / results.length) * 100) : 50;

  return {
    sector,
    sectorRank,
    competitiveAdvantage: betterCount > results.length / 2,
    metrics: results,
  };
}

// ─── ANA FONKSİYON: Tüm temel analizi birleştir ──────────────────────────────

export function analyzeCompanyFundamentals(ratios, fundamentals, sector = 'Unknown', regimeName = 'Sakin') {
  // En güncel ve bir önceki dönem
  const sorted = (fundamentals || []).sort((a, b) => b.period.localeCompare(a.period));
  const currentFund = sorted[0] || null;
  const previousFund = sorted[1] || null;

  const robustness = calculateRobustnessScore(ratios);
  const growth = calculateGrowthScore(currentFund, previousFund);
  const regimeKey = regimeName === 'Kriz' ? 'crisis' : 'calm';
  const combined = calculateFundamentalScore(robustness, growth, regimeKey);
  const sectorResult = sectorComparison(ratios, sector);

  // Türkçe yorum
  const commentary = [];
  if (combined.score >= 80) commentary.push(`🏆 Şirket hem finansal sağlamlık hem büyüme potansiyeli açısından üst sınıfta. Temel analiz güçlü AL desteği veriyor.`);
  else if (combined.score >= 65) commentary.push(`✅ Şirket finansal sağlamlık açısından iyi durumda. Büyüme hızı sınırlı olsa da risk dengeli.`);
  else if (combined.score >= 50) commentary.push(`⚠️ Şirket ortalama bir performans sergiliyor. Belirli alanlarda iyileştirme gerekli, izlemeye alın.`);
  else commentary.push(`🔴 Şirket finansal riskler taşıyor. Yatırım yapmadan önce likidite ve borç yapısını inceleyin.`);

  if (robustness.components.cariOran.level === 'red') commentary.push('Likidite krizi riski var!');
  if (robustness.components.kaldirac.level === 'red') commentary.push('Aşırı kaldıraç — borç yükü sürdürülemez seviyede.');
  if (sectorResult.competitiveAdvantage) commentary.push(`Sektör (${sector}) ortalamasının üzerinde performans gösteriyor.`);

  return {
    combined,
    robustness,
    growth,
    sectorComparison: sectorResult,
    commentary: commentary.join(' '),
  };
}

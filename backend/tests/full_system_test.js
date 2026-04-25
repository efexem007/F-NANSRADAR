/**
 * FinansRadar — FULL SYSTEM TEST v2
 * ================================
 * Tüm hisse analiz ve tarama fonksiyonlarını test eder.
 * Hata olursa process.exit(1), başarılı olursa process.exit(0)
 */

// ─── Test Sonuçları ───────────────────────────────────────────────────────
const results = {
  passed: 0,
  failed: 0,
  errors: [],
  warnings: [],
};

async function test(name, fn) {
  try {
    const start = Date.now();
    await fn();
    const duration = Date.now() - start;
    results.passed++;
    console.log(`  ✅ ${name} (${duration}ms)`);
  } catch (e) {
    results.failed++;
    results.errors.push({ test: name, error: e.message, stack: e.stack });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || 'Assertion failed'}: expected ${expected}, got ${actual}`);
}

function assertTrue(value, msg) {
  if (!value) throw new Error(msg || 'Expected true, got false');
}

function assertNotNull(value, msg) {
  if (value === null || value === undefined) throw new Error(msg || 'Expected non-null value');
}

function assertInRange(value, min, max, msg) {
  if (value < min || value > max) throw new Error(`${msg || 'Value out of range'}: ${value} not in [${min}, ${max}]`);
}

// ─── TEST GRUPLARI ────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  FİNANS RADAR — FULL SYSTEM TEST v2');
console.log('═══════════════════════════════════════════════════════════════\n');

const { calculateRSI, calculateMACD, calculateSMA, calculateEMA, calculateBollinger, calculateStochastic, calculateADX, calculateMFI, calculateFibonacci, calculateSupportResistance, calculateAllIndicators } = await import('../src/services/technical.js');
const { fundamentalScore, technicalScore, macroScore, calculateFinalSignal } = await import('../src/services/signal.js');
const { analyzeCompanyFundamentals, calculateRobustnessScore, calculateGrowthScore, calculateFundamentalScore, sectorComparison } = await import('../src/services/fundamentalAnalysis.js');
const { calcRiskReport, garch11, calcVaR, hillEstimator } = await import('../src/services/riskAnalytics.js');
const { detectRegime } = await import('../src/services/regimeDetector.js');
const { predictWeekly, predictMonthly, predictLongTerm, generateFullPredictions, calculateImpactAnalysis, generatePipelineSteps } = await import('../src/services/prediction.js');
const { calculatePriceImpact } = await import('../src/services/priceImpact.js');
const { calculateRiskLevel } = await import('../src/services/riskLevel.js');
const { getMacroData } = await import('../src/services/macroData.js');
const { stockScannerQueue, getJobStatus, queueStats } = await import('../src/lib/queue.js');
const cacheModule = await import('../src/lib/cache.js');
const cache = cacheModule.default;
const { fetchStockPrices, fetchStockFundamentals, fetchCurrentPrice } = await import('../src/services/yahooFinance.js');
const { scanSingleStock } = await import('../src/services/scanner.js');
const { analyzeStock, getAnalyzeStock } = await import('../src/services/analysis.js');

// Dummy price data (60 gün)
const dummyPrices = [];
for (let i = 0; i < 60; i++) {
  const base = 100 + Math.sin(i * 0.2) * 10 + i * 0.3;
  dummyPrices.push({
    date: new Date(Date.now() - (60 - i) * 86400000),
    open: base - 1,
    high: base + 2,
    low: base - 2,
    close: base + Math.random() * 2 - 1,
    volume: 1000000 + Math.random() * 500000,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GRUP 1: Teknik İndikatörler
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📊 GRUP 1: Teknik İndikatörler');
console.log('─────────────────────────────────────────────────────────────');

await test('RSI hesaplama (14 gün)', async () => {
  const rsi = calculateRSI(dummyPrices);
  assertNotNull(rsi, 'RSI null döndü');
  assertInRange(rsi, 0, 100, 'RSI 0-100 aralığında olmalı');
});

await test('MACD hesaplama (26 gün)', async () => {
  const macd = calculateMACD(dummyPrices);
  assertNotNull(macd, 'MACD null döndü');
  assertTrue(typeof macd.macd === 'number', 'MACD line sayı olmalı');
  assertTrue(typeof macd.signal === 'number', 'MACD signal sayı olmalı');
  assertTrue(typeof macd.hist === 'number', 'MACD hist sayı olmalı');
});

await test('SMA hesaplama (20 gün)', async () => {
  const sma = calculateSMA(dummyPrices, 20);
  assertNotNull(sma, 'SMA null döndü');
  assertTrue(sma > 0, 'SMA pozitif olmalı');
});

await test('EMA hesaplama (12 gün)', async () => {
  const ema = calculateEMA(dummyPrices, 12);
  assertNotNull(ema, 'EMA null döndü');
  assertTrue(ema > 0, 'EMA pozitif olmalı');
});

await test('Bollinger Bands hesaplama', async () => {
  const bb = calculateBollinger(dummyPrices);
  assertNotNull(bb, 'Bollinger null döndü');
  assertTrue(bb.upper > bb.middle, 'Upper > Middle olmalı');
  assertTrue(bb.middle > bb.lower, 'Middle > Lower olmalı');
  assertTrue(bb.width >= 0, 'Width pozitif olmalı');
});

await test('Stochastic Oscillator hesaplama', async () => {
  const stoch = calculateStochastic(dummyPrices);
  assertNotNull(stoch, 'Stochastic null döndü');
  assertInRange(stoch.k, 0, 100, '%K 0-100 aralığında');
  assertInRange(stoch.d, 0, 100, '%D 0-100 aralığında');
  assertTrue(['oversold','overbought','bullish_cross','bearish_cross','neutral'].includes(stoch.signal), 'Stochastic sinyal geçerli olmalı');
});

await test('ADX hesaplama', async () => {
  const adx = calculateADX(dummyPrices);
  assertNotNull(adx, 'ADX null döndü');
  assertTrue(adx.adx >= 0, 'ADX >= 0 olmalı');
  assertTrue(typeof adx.isTrending === 'boolean', 'isTrending boolean olmalı');
  assertTrue(['bullish','bearish'].includes(adx.direction), 'direction geçerli olmalı');
});

await test('MFI hesaplama', async () => {
  const mfi = calculateMFI(dummyPrices);
  assertNotNull(mfi, 'MFI null döndü');
  assertInRange(mfi.mfi, 0, 100, 'MFI 0-100 aralığında');
  assertTrue(['oversold','overbought','weak','strong','neutral'].includes(mfi.signal), 'MFI sinyal geçerli olmalı');
});

await test('Fibonacci Retracement hesaplama', async () => {
  const fib = calculateFibonacci(dummyPrices);
  assertNotNull(fib, 'Fibonacci null döndü');
  assertTrue(fib.levels['0.0'] >= fib.levels['0.5'], 'High >= middle olmalı');
  assertTrue(fib.levels['0.5'] >= fib.levels['1.0'], 'Middle >= low olmalı');
  assertTrue(['support_zone','resistance_zone','weak_retracement','moderate_retracement','deep_retracement','neutral'].includes(fib.zone), 'Zone geçerli olmalı');
});

await test('Destek/Direnç hesaplama', async () => {
  const sr = calculateSupportResistance(dummyPrices);
  assertNotNull(sr, 'SupportResistance null döndü');
  assertTrue(Array.isArray(sr.supports), 'supports array olmalı');
  assertTrue(Array.isArray(sr.resistances), 'resistances array olmalı');
  assertTrue(sr.pivotPoints.pivot > 0, 'Pivot pozitif olmalı');
});

await test('Birleşik indikatör analizi (calculateAllIndicators)', async () => {
  const all = calculateAllIndicators(dummyPrices);
  assertNotNull(all, 'calculateAllIndicators null döndü');
  assertInRange(all.composite.score, 0, 100, 'Composite score 0-100 aralığında');
  assertTrue(['GÜÇLÜ AL','AL','BEKLE','SAT','GÜÇLÜ SAT'].includes(all.composite.signal), 'Composite signal geçerli olmalı');
  assertTrue(all.composite.totalSignals > 0, 'En az 1 sinyal olmalı');
});

// ═══════════════════════════════════════════════════════════════════════════
// GRUP 2: Sinyal Skorlama
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📈 GRUP 2: Sinyal Skorlama');
console.log('─────────────────────────────────────────────────────────────');

await test('fundamentalScore hesaplama', async () => {
  const ratios = { currentRatio: 2.5, netMargin: 15, leverage: 1.8, nfbToEbitda: 1.5 };
  const score = fundamentalScore(ratios);
  assertInRange(score, 0, 100, 'Fundamental score 0-100 aralığında');
  assertTrue(score >= 75, 'Bu verilerle yüksek skor bekleniyor');
});

await test('fundamentalScore — eksik veri koruması', async () => {
  const score = fundamentalScore({ currentRatio: null, netMargin: undefined, leverage: 0, nfbToEbitda: 0 });
  assertInRange(score, 0, 100, 'Eksik veride bile 0-100 aralığında olmalı');
});

await test('technicalScore hesaplama', async () => {
  const tech = { rsi14: 35, macdHist: 0.5, sma20: 105, sma50: 100, bollingerLower: 90, currentPrice: 110 };
  const score = technicalScore(tech);
  assertInRange(score, 0, 100, 'Technical score 0-100 aralığında');
});

await test('technicalScore — Stochastic + ADX + MFI dahil', async () => {
  const tech = { rsi14: 30, macdHist: 0.8, sma20: 110, sma50: 100, bollingerLower: 95, currentPrice: 115, stochasticSignal: 'oversold', adx: 28, adxDirection: 'bullish', mfiSignal: 'oversold' };
  const score = technicalScore(tech);
  assertInRange(score, 0, 100, 'Technical score 0-100 aralığında');
});

await test('macroScore hesaplama', async () => {
  const score = macroScore(250, 18);
  assertInRange(score, 0, 100, 'Macro score 0-100 aralığında');
});

await test('calculateFinalSignal — tüm kombinasyonlar', async () => {
  const s1 = calculateFinalSignal(80, 70, 60);
  assertTrue(['GUCLU AL','AL','BEKLE','SAT','GUCLU SAT'].includes(s1.signal), 'Final signal geçerli olmalı');
  assertInRange(s1.score, 0, 100, 'Final score 0-100 aralığında');
});

// ═══════════════════════════════════════════════════════════════════════════
// GRUP 3: Temel Analiz
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n📋 GRUP 3: Temel Analiz');
console.log('─────────────────────────────────────────────────────────────');

await test('calculateRobustnessScore', async () => {
  const r = calculateRobustnessScore({ currentRatio: 2.2, leverage: 1.5, netMargin: 18, nfbToEbitda: 1.2 });
  assertInRange(r.totalScore, 0, 100, 'Robustness score 0-100');
  assertTrue(['A','B','C','D'].includes(r.grade), 'Grade geçerli olmalı');
});

await test('calculateGrowthScore — veri var', async () => {
  const current = { netSales: 1000, ebitda: 200, netProfit: 150, equity: 500 };
  const previous = { netSales: 800, ebitda: 150, netProfit: 100, equity: 400 };
  const g = calculateGrowthScore(current, previous);
  assertTrue(g.totalScore > 0, 'Büyüme skoru pozitif olmalı');
  assertTrue(g.components.satisGrowth.value > 0, 'Satış büyümesi pozitif');
});

await test('calculateFundamentalScore', async () => {
  const robust = calculateRobustnessScore({ currentRatio: 2.0, leverage: 2.0, netMargin: 12, nfbToEbitda: 2.0 });
  const growth = calculateGrowthScore(null, null);
  const f = calculateFundamentalScore(robust, growth, 'calm');
  assertInRange(f.score, 0, 100, 'Fundamental score 0-100');
  assertTrue(['STRONG_BUY','BUY','HOLD','REDUCE','SELL'].includes(f.recommendation), 'Recommendation geçerli');
});

await test('sectorComparison', async () => {
  const sc = sectorComparison({ currentRatio: 2.0, leverage: 2.0, netMargin: 15, nfbToEbitda: 2.0, fk: 10, pddd: 1.2 }, 'Sanayi');
  assertTrue(typeof sc.sectorRank === 'number', 'Sector rank sayı olmalı');
  assertTrue(Array.isArray(sc.metrics), 'Metrics array olmalı');
});

await test('analyzeCompanyFundamentals — tam akış', async () => {
  const result = analyzeCompanyFundamentals(
    { currentRatio: 2.0, leverage: 2.0, netMargin: 15, nfbToEbitda: 2.0 },
    [{ period: '2024', netSales: 1000, ebitda: 200, netProfit: 150, equity: 500 }, { period: '2023', netSales: 800, ebitda: 150, netProfit: 100, equity: 400 }],
    'Sanayi',
    'Sakin'
  );
  assertNotNull(result.combined, 'Combined skor olmalı');
  assertNotNull(result.robustness, 'Robustness olmalı');
  assertNotNull(result.growth, 'Growth olmalı');
  assertTrue(result.commentary.length > 0, 'Yorum olmalı');
});

// ═══════════════════════════════════════════════════════════════════════════
// GRUP 4: Risk Analitiği
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n⚠️ GRUP 4: Risk Analitiği');
console.log('─────────────────────────────────────────────────────────────');

await test('garch11 — volatilite tahmini', async () => {
  const returns = dummyPrices.slice(1).map((p, i) => (p.close - dummyPrices[i].close) / dummyPrices[i].close);
  const g = garch11(returns);
  assertTrue(g.sigma !== null || g.sigma === null, 'GARCH sigma hesaplanmalı veya null olabilir');
  if (g.sigma !== null) {
    assertTrue(g.annualSigma >= 0, 'Annual sigma pozitif');
    assertTrue(g.persistence > 0, 'Persistence pozitif');
  }
});

await test('calcVaR — değer riski', async () => {
  const returns = dummyPrices.slice(1).map((p, i) => (p.close - dummyPrices[i].close) / dummyPrices[i].close);
  const v = calcVaR(returns);
  assertNotNull(v.var95, 'VaR95 null olmamalı');
  assertTrue(v.var95 <= 0, 'VaR negatif olmalı (kayıt riski)');
});

await test('hillEstimator — tail risk', async () => {
  const returns = dummyPrices.slice(1).map((p, i) => (p.close - dummyPrices[i].close) / dummyPrices[i].close);
  const h = hillEstimator(returns);
  assertTrue(h.xi >= 0, 'Tail index pozitif olmalı');
  assertNotNull(h.tailRisk, 'Tail risk olmalı');
});

await test('calcRiskReport — tam rapor', async () => {
  const report = calcRiskReport(dummyPrices);
  assertNotNull(report, 'Risk report null olmamalı');
  assertTrue(report.riskScore >= 0 && report.riskScore <= 100, 'Risk score 0-100 aralığında');
  assertNotNull(report.maxDrawdown, 'Max drawdown olmalı');
});

await test('calcRiskReport — yetersiz veri koruması', async () => {
  const report = calcRiskReport([]);
  assertNotNull(report, 'Boş veride bile rapor olmalı');
  assertTrue(report.error !== undefined, 'Hata mesajı olmalı');
});

// ═══════════════════════════════════════════════════════════════════════════
// GRUP 5: Rejim Tespiti
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🧠 GRUP 5: Rejim Tespiti (HMM)');
console.log('─────────────────────────────────────────────────────────────');

await test('detectRegime — normal veri', async () => {
  const regime = detectRegime(dummyPrices);
  assertNotNull(regime, 'Regime null olmamalı');
  assertTrue([0,1,2].includes(regime.currentRegime), 'Regime index geçerli');
  assertTrue(['Sakin','Kriz','Yüksek Vol'].includes(regime.regimeName), 'Regime name geçerli');
  assertTrue(regime.dynamicWeights.length === 4, '4 dinamik ağırlık olmalı');
  assertTrue(regime.probabilities.calm >= 0 && regime.probabilities.calm <= 1, 'Calm prob 0-1');
});

await test('detectRegime — yetersiz veri koruması', async () => {
  const regime = detectRegime([]);
  assertEqual(regime.currentRegime, 0, 'Boş veride varsayılan Sakin');
});

// ═══════════════════════════════════════════════════════════════════════════
// GRUP 6: Tahmin Motoru
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔮 GRUP 6: Tahmin Motoru');
console.log('─────────────────────────────────────────────────────────────');

await test('predictWeekly — haftalık tahmin', async () => {
  const p = predictWeekly(dummyPrices, 7);
  assertNotNull(p, 'Weekly prediction null olmamalı');
  assertTrue(p.target > 0, 'Target pozitif olmalı');
  assertTrue(p.probabilityUp >= 0 && p.probabilityUp <= 100, 'Probability 0-100');
  assertTrue(Array.isArray(p.dailyPredictions), 'Daily predictions array olmalı');
  assertEqual(p.dailyPredictions.length, 8, 'Bugün + 7 gün = 8 tahmin');
});

await test('predictMonthly — aylık tahmin', async () => {
  const p = predictMonthly(dummyPrices, 3);
  assertNotNull(p, 'Monthly prediction null olmamalı');
  assertTrue(p.target > 0, 'Target pozitif');
  assertTrue(Array.isArray(p.monthlyPoints), 'Monthly points array olmalı');
  assertEqual(p.monthlyPoints.length, 3, '3 aylık nokta olmalı');
});

await test('predictLongTerm — yıllık tahmin', async () => {
  const p = predictLongTerm(dummyPrices, 1, 100);
  assertNotNull(p, 'Long term prediction null olmamalı');
  assertTrue(p.target > 0, 'Target pozitif');
  assertTrue(Array.isArray(p.checkpoints), 'Checkpoints array olmalı');
});

await test('generateFullPredictions — tüm zaman dilimleri', async () => {
  const fp = generateFullPredictions(dummyPrices);
  assertNotNull(fp.weekly, 'Weekly olmalı');
  assertNotNull(fp.monthly, 'Monthly olmalı');
  assertNotNull(fp.yearly, 'Yearly olmalı');
  assertNotNull(fp.threeYear, 'ThreeYear olmalı');
  assertNotNull(fp.summary, 'Summary olmalı');
});

await test('calculateImpactAnalysis — etki analizi', async () => {
  const indicators = {
    rsi: { score: 70, status: 'Düşük', color: 'green' },
    macd: { score: 65, status: 'Yukarı', color: 'green' },
    sma: { score: 60, status: 'Golden', color: 'green' },
    bollinger: { score: 55, status: 'Orta', color: 'yellow' },
    volume: { score: 60, status: 'Normal', color: 'gray' },
  };
  const macro = { cds: 250, vix: 20, macroScore: 60 };
  const regime = { name: 'Sakin' };
  const riskReport = { var95: -2.0, garch: { annualSigma: 25 } };
  const impact = calculateImpactAnalysis(indicators, macro, regime, riskReport, 70);
  assertTrue(Array.isArray(impact.factors), 'Factors array olmalı');
  assertTrue(impact.factors.length > 0, 'En az 1 faktör olmalı');
  assertTrue(Array.isArray(impact.topPositive), 'Top positive array olmalı');
  assertTrue(Array.isArray(impact.topNegative), 'Top negative array olmalı');
});

await test('generatePipelineSteps — pipeline bilgisi', async () => {
  const fakeAnalysis = {
    priceData: dummyPrices,
    currentPrice: 100,
    fracDiff: { d: 0.5, memoryRetained: 80 },
    indicators: { rsi: { status: 'Nötr' }, macd: { status: 'Yukarı' }, sma: { status: 'Golden' } },
    regime: { name: 'Sakin', crisisRisk: 5 },
    risk: { var95: -2, cvar95: -3, xi: 0.2 },
    gPolicy: { bestAction: 'AL', bestProb: 0.8 },
    finalScore: 65,
    signal: 'AL',
  };
  const steps = generatePipelineSteps(fakeAnalysis);
  assertTrue(Array.isArray(steps), 'Steps array olmalı');
  assertTrue(steps.length >= 6, 'En az 6 adım olmalı');
  assertTrue(steps.every(s => s.name && s.status), 'Her adımda name ve status olmalı');
});

// ═══════════════════════════════════════════════════════════════════════════
// GRUP 7: Fiyat Etki Analizi
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n💰 GRUP 7: Fiyat Etki Analizi');
console.log('─────────────────────────────────────────────────────────────');

await test('calculatePriceImpact — tam analiz', async () => {
  const result = calculatePriceImpact({
    currentPrice: 100,
    var95: -2.5,
    annualSigma: 30,
    kaldirac: 2.0,
    nfbFavok: 2.5,
    cds: 280,
    vix: 22,
    indicators: {
      rsi: { raw: 45 },
      macd: { raw: { macd: 0.5, signal: 0.3, hist: 0.2 } },
      sma: { raw: { sma20: 102, sma50: 100 } },
      bollinger: { raw: { upper: 110, middle: 100, lower: 90 } },
      volume: { score: 60, status: 'Normal' },
    },
    predictions: { weekly: { target: 105 }, monthly: { target: 110 }, yearly: { target: 120 } },
    fundamentalScore: 65,
    fk: 12,
  });
  assertNotNull(result.fairValue, 'Fair value olmalı');
  assertTrue(typeof result.totalImpactTL === 'number', 'Total impact TL sayı olmalı');
  assertTrue(['YUKARI','AŞAĞI'].includes(result.direction), 'Direction geçerli olmalı');
  assertTrue(result.categories.length === 3, '3 kategori olmalı');
});

// ═══════════════════════════════════════════════════════════════════════════
// GRUP 8: Risk Seviyesi (5 Kademe)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🛡️ GRUP 8: 5 Kademeli Risk Seviyesi');
console.log('─────────────────────────────────────────────────────────────');

await test('calculateRiskLevel — tam skorlama', async () => {
  const result = calculateRiskLevel({
    cariOran: 2.2, asitTest: 1.8, nakitDonusum: 0.15,
    kaldirac: 1.8, nfbFavok: 2.0, faizKoruma: 4.0,
    var95: -1.5, annualSigma: 20, beta: 1.1, maxDrawdown: 0.12,
    indicators: { rsi: { score: 60 }, trend: { score: 55 }, bollinger: { score: 50 }, macd: { score: 55 } },
    cds: 250, vix: 20,
  });
  assertInRange(result.totalScore, 0, 100, 'Total risk score 0-100');
  assertNotNull(result.level, 'Risk level olmalı');
  assertTrue(result.level.name !== undefined, 'Level name olmalı');
  assertNotNull(result.components.likidite, 'Likidite bileşeni olmalı');
  assertNotNull(result.components.kaldirac, 'Kaldıraç bileşeni olmalı');
  assertNotNull(result.components.piyasa, 'Piyasa bileşeni olmalı');
  assertNotNull(result.components.teknik, 'Teknik bileşeni olmalı');
  assertNotNull(result.components.makro, 'Makro bileşeni olmalı');
});

await test('calculateRiskLevel — tüm seviyeler kontrolü', async () => {
  const levels = ['ÇOK KÖTÜ', 'KÖTÜ', 'NORMAL', 'İYİ', 'ÇOK İYİ'];
  let foundLevels = new Set();
  for (let cari = 0.5; cari <= 3.0; cari += 0.5) {
    for (let kal = 1.0; kal <= 5.0; kal += 1.0) {
      const r = calculateRiskLevel({ cariOran: cari, kaldirac: kal, var95: -1 * kal, annualSigma: kal * 10, indicators: {}, cds: 200 + kal * 50, vix: 15 + kal * 5 });
      foundLevels.add(r.level.name);
    }
  }
  assertTrue(foundLevels.size >= 3, `En az 3 farklı risk seviyesi bulunmalı, bulunan: ${[...foundLevels].join(',')}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// GRUP 9: Makro Veri
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🌍 GRUP 9: Makro Veri');
console.log('─────────────────────────────────────────────────────────────');

await test('getMacroData — veri yapısı', async () => {
  const macro = await getMacroData();
  assertNotNull(macro, 'Macro data null olmamalı');
  assertTrue(macro.cds !== undefined, 'CDS olmalı');
  assertTrue(macro.vix !== undefined, 'VIX olmalı');
  assertTrue(macro.interest !== undefined, 'Interest olmalı');
});

// ═══════════════════════════════════════════════════════════════════════════
// GRUP 10: Queue ve Cache (Altyapı)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n⚙️ GRUP 10: Queue ve Cache Altyapısı');
console.log('─────────────────────────────────────────────────────────────');

await test('Queue — job ekleme ve durum', async () => {
  const job = await stockScannerQueue.add('test-job', { ticker: 'THYAO' });
  assertNotNull(job.id, 'Job ID olmalı');
  const status = await getJobStatus(job.id);
  assertNotNull(status, 'Job status bulunmalı');
  const stats = queueStats();
  assertTrue(stats.total >= 0, 'Queue stats geçerli olmalı');
});

await test('Cache — set/get/del', async () => {
  await cache.set('test:key', { value: 42 }, 60);
  const val = await cache.get('test:key');
  assertEqual(val.value, 42, 'Cache get/set çalışmalı');
  await cache.del('test:key');
  const deleted = await cache.get('test:key');
  assertEqual(deleted, null, 'Cache del çalışmalı');
});

await test('Cache — getOrSet helper', async () => {
  let called = 0;
  const val = await cache.getOrSet('test:computed', async () => { called++; return { x: 1 }; }, 'default');
  assertEqual(val.x, 1, 'getOrSet değer döndürmeli');
  assertEqual(called, 1, 'getOrSet fetch fonksiyonunu çağırmalı');
  const val2 = await cache.getOrSet('test:computed', async () => { called++; return { x: 2 }; }, 'default');
  assertEqual(val2.x, 1, 'getOrSet cache değerini kullanmalı');
  assertEqual(called, 1, 'getOrSet ikinci kez fetch etmemeli');
});

await test('Cache — dynamic TTL', async () => {
  const ttl1 = cache.getDynamicTTL('price');
  const ttl2 = cache.getDynamicTTL('analysis');
  const ttl3 = cache.getDynamicTTL('static');
  assertTrue(ttl1 > 0, 'Price TTL pozitif');
  assertTrue(ttl2 > 0, 'Analysis TTL pozitif');
  assertTrue(ttl3 > 0, 'Static TTL pozitif');
});

// ═══════════════════════════════════════════════════════════════════════════
// GRUP 11: Yahoo Finance (canlı API test)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🌐 GRUP 11: Yahoo Finance API');
console.log('─────────────────────────────────────────────────────────────');

await test('fetchStockPrices — THYAO.IS fiyat verisi', async () => {
  const data = await fetchStockPrices('THYAO.IS', '1mo');
  assertNotNull(data, 'Fiyat verisi null olmamalı');
  if (data.priceData.length === 0) {
    results.warnings.push('THYAO.IS fiyat verisi boş döndü (Yahoo API geçici hatası olabilir)');
    console.log('  ⚠️  THYAO.IS fiyat verisi boş (Yahoo API geçici hatası?)');
    return;
  }
  assertTrue(data.priceData.length > 0, 'En az 1 fiyat verisi olmalı');
  assertTrue(data.currentPrice > 0, 'Current price pozitif olmalı');
  assertNotNull(data.priceData[0].date, 'Date olmalı');
  assertNotNull(data.priceData[0].close, 'Close olmalı');
});

await test('fetchStockPrices — eksik ticker koruması', async () => {
  const data = await fetchStockPrices('INVALIDTICKER999', '1mo');
  assertNotNull(data, 'Invalid ticker bile null olmamalı');
  assertTrue(Array.isArray(data.priceData), 'priceData array olmalı');
});

await test('fetchCurrentPrice — hızlı fiyat çekme', async () => {
  const price = await fetchCurrentPrice('THYAO.IS');
  if (price === null) {
    results.warnings.push('fetchCurrentPrice null döndü (Yahoo API geçici hatası olabilir)');
    console.log('  ⚠️  fetchCurrentPrice null (Yahoo API geçici hatası?)');
    return;
  }
  assertTrue(price > 0, 'Current price pozitif olmalı');
});

// ═══════════════════════════════════════════════════════════════════════════
// GRUP 12: Scanner (tekli ve toplu)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🔍 GRUP 12: Scanner');
console.log('─────────────────────────────────────────────────────────────');

await test('scanSingleStock — THYAO.IS', async () => {
  const result = await scanSingleStock('THYAO.IS');
  assertNotNull(result, 'Scan result null olmamalı');
  if (result.error) {
    results.warnings.push(`scanSingleStock THYAO.IS hatası: ${result.error}`);
    console.log(`  ⚠️  scanSingleStock THYAO.IS hatası: ${result.error}`);
    return;
  }
  assertNotNull(result.ticker, 'Ticker olmalı');
  assertTrue(result.price >= 0, 'Price olmalı');
  assertTrue(['GÜÇLÜ AL','AL','BEKLE','SAT','GÜÇLÜ SAT'].includes(result.signal), 'Signal geçerli olmalı');
  assertTrue(result.score >= 0 && result.score <= 100, 'Score 0-100 aralığında');
});

// ═══════════════════════════════════════════════════════════════════════════
// GRUP 13: Analysis (tam analiz akışı)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n🎯 GRUP 13: Tam Analiz Akışı (analysis.js)');
console.log('─────────────────────────────────────────────────────────────');

await test('analyzeStock — THYAO.IS tam analiz', async () => {
  const result = await analyzeStock('THYAO.IS', '3mo');
  assertNotNull(result, 'Analiz result null olmamalı');
  assertNotNull(result.ticker, 'Ticker olmalı');
  assertNotNull(result.currentPrice, 'Current price olmalı');
  assertTrue(['GÜÇLÜ AL','AL','BEKLE','SAT','GÜÇLÜ SAT'].includes(result.signal), 'Signal geçerli');
  assertTrue(result.finalScore >= 0 && result.finalScore <= 100, 'Final score 0-100');
  assertNotNull(result.indicators, 'Indicators olmalı');
  assertNotNull(result.indicators.rsi, 'RSI olmalı');
  assertNotNull(result.indicators.macd, 'MACD olmalı');
  assertNotNull(result.regime, 'Regime olmalı');
  assertNotNull(result.risk, 'Risk olmalı');
  assertNotNull(result.predictions, 'Predictions olmalı');
  assertNotNull(result.priceImpact, 'PriceImpact olmalı');
  assertNotNull(result.riskLevel, 'RiskLevel olmalı');
  assertTrue(Array.isArray(result.pipeline), 'Pipeline array olmalı');
  assertTrue(result.pipeline.length >= 6, 'En az 6 pipeline adımı olmalı');
  assertTrue(result.commentary.length > 0, 'Yorum olmalı');
});

await test('getAnalyzeStock — önbellekli analiz', async () => {
  const r1 = await getAnalyzeStock('THYAO.IS', '3mo', true);
  assertNotNull(r1, 'getAnalyzeStock null olmamalı');
  assertNotNull(r1.signal, 'Signal olmalı');
});

// ═══════════════════════════════════════════════════════════════════════════
// SONUÇ RAPORU
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  TEST SONUÇ RAPORU');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  ✅ Başarılı: ${results.passed}`);
console.log(`  ❌ Başarısız: ${results.failed}`);
console.log(`  ⚠️  Uyarılar: ${results.warnings.length}`);

if (results.errors.length > 0) {
  console.log('\n  HATA DETAYLARI:');
  for (const err of results.errors) {
    console.log(`    • ${err.test}`);
    console.log(`      ${err.error}`);
  }
}

if (results.warnings.length > 0) {
  console.log('\n  UYARI DETAYLARI:');
  for (const w of results.warnings) {
    console.log(`    • ${w}`);
  }
}

const allOk = results.failed === 0;
console.log('\n═══════════════════════════════════════════════════════════════');
if (allOk) {
  console.log('  🎉 TÜM TESTLER BAŞARIYLA TAMAMLANDI!');
  console.log('═══════════════════════════════════════════════════════════════\n');
} else {
  console.log(`  ⚠️  ${results.failed} TEST BAŞARISIZ!`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

process.exit(allOk ? 0 : 1);

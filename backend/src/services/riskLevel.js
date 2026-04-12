/**
 * FinansRadar — 5 Kademeli Matematiksel Risk Skorlama Sistemi
 * ============================================================
 * Formül: RSK = Σ(wi × Ri)
 * 
 * Bileşenler:
 *   1. Likidite Riski (w=0.25): Cari Oran, Asit Test, Nakit Dönüşüm
 *   2. Kaldıraç Riski (w=0.25): Kaldıraç, NFB/FAVÖK, Faiz Koruma
 *   3. Piyasa Riski   (w=0.20): VaR₉₅, Volatilite, Beta, Max Drawdown
 *   4. Teknik Risk    (w=0.15): ADX/Trend gücü, Trend yönü, Bollinger pozisyonu
 *   5. Makro Risk     (w=0.15): CDS, VIX, Kur etkisi
 *
 * 5 Kademe:
 *   🔴 ÇOK KÖTÜ (0-20)  → KRİTİK RİSK
 *   🟠 KÖTÜ     (20-40) → YÜKSEK RİSK
 *   🟡 NORMAL   (40-60) → ORTA RİSK
 *   🟢 İYİ      (60-80) → DÜŞÜK RİSK
 *   🔵 ÇOK İYİ  (80-100)→ MİNİMAL RİSK
 */

// ═══════════════════════════════════════════════════════════════════════════
// AĞIRLIKLAR
// ═══════════════════════════════════════════════════════════════════════════

const WEIGHTS = {
  likidite: 0.25,
  kaldirac: 0.25,
  piyasa:   0.20,
  teknik:   0.15,
  makro:    0.15,
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. LİKİDİTE SKORU (0-100)
// Formül: L = 0.4×Cari + 0.4×Asit + 0.2×Nakit
// ═══════════════════════════════════════════════════════════════════════════

function scoreCari(cariOran) {
  if (cariOran == null) return 50;
  if (cariOran >= 2.5) return 100;
  if (cariOran >= 2.0) return 80 + (cariOran - 2.0) * 40;
  if (cariOran >= 1.5) return 60 + (cariOran - 1.5) * 40;
  if (cariOran >= 1.0) return 40 + (cariOran - 1.0) * 40;
  if (cariOran >= 0.5) return 20 + (cariOran - 0.5) * 40;
  return Math.max(0, cariOran * 40);
}

function scoreAsit(asitTest) {
  if (asitTest == null) return 50;
  if (asitTest >= 2.0) return 100;
  if (asitTest >= 1.5) return 80 + (asitTest - 1.5) * 40;
  if (asitTest >= 1.0) return 60 + (asitTest - 1.0) * 40;
  if (asitTest >= 0.5) return 40 + (asitTest - 0.5) * 40;
  return Math.max(0, asitTest * 80);
}

function calcLikiditeScore(cariOran, asitTest, nakitDonusum) {
  const sCari = scoreCari(cariOran);
  const sAsit = scoreAsit(asitTest);
  const sNakit = nakitDonusum != null && nakitDonusum > 0 ? Math.min(100, nakitDonusum * 100) : 50;
  const score = 0.4 * sCari + 0.4 * sAsit + 0.2 * sNakit;
  
  let status, detail;
  if (score >= 80) { status = 'Güçlü Likidite'; detail = `Cari Oran: ${cariOran?.toFixed(2) || '—'} — Nakit durumu mükemmel, krizlere dayanıklı.`; }
  else if (score >= 60) { status = 'Yeterli Likidite'; detail = `Cari Oran: ${cariOran?.toFixed(2) || '—'} — Normal likidite seviyesi.`; }
  else if (score >= 40) { status = 'Sıkışma Riski'; detail = `Cari Oran: ${cariOran?.toFixed(2) || '—'} — Kısa vadeli borçları karşılama kapasitesi zorlanabilir.`; }
  else { status = 'Likidite Krizi'; detail = `Cari Oran: ${cariOran?.toFixed(2) || '—'} — Acil nakit ihtiyacı olabilir!`; }

  return { score: parseFloat(score.toFixed(1)), status, detail, components: { cari: parseFloat(sCari.toFixed(1)), asit: parseFloat(sAsit.toFixed(1)), nakit: parseFloat(sNakit.toFixed(1)) } };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. KALDIRAÇ SKORU (0-100) — Ters orantılı
// Formül: K = 0.5×(1/Kaldıraç_norm) + 0.3×(1/NFB_norm) + 0.2×Faiz_Koruma
// ═══════════════════════════════════════════════════════════════════════════

function scoreKaldiracVal(kaldirac) {
  if (kaldirac == null) return 50;
  if (kaldirac <= 1.5) return 100;
  if (kaldirac <= 2.0) return 100 - (kaldirac - 1.5) * 40;
  if (kaldirac <= 3.0) return 80 - (kaldirac - 2.0) * 30;
  if (kaldirac <= 4.0) return 50 - (kaldirac - 3.0) * 30;
  if (kaldirac <= 5.0) return 20 - (kaldirac - 4.0) * 15;
  return Math.max(0, 5 - (kaldirac - 5.0));
}

function scoreNfbFavok(nfbFavok) {
  if (nfbFavok == null) return 50;
  if (nfbFavok <= 1.0) return 100;
  if (nfbFavok <= 2.0) return 100 - (nfbFavok - 1.0) * 20;
  if (nfbFavok <= 3.0) return 80 - (nfbFavok - 2.0) * 30;
  if (nfbFavok <= 4.0) return 50 - (nfbFavok - 3.0) * 25;
  return Math.max(0, 25 - (nfbFavok - 4.0) * 5);
}

function scoreFaizKoruma(faizKoruma) {
  if (faizKoruma == null) return 50;
  if (faizKoruma >= 5.0) return 100;
  if (faizKoruma >= 3.0) return 80 + (faizKoruma - 3.0) * 10;
  if (faizKoruma >= 1.5) return 50 + (faizKoruma - 1.5) * 20;
  return Math.max(0, faizKoruma * 33.3);
}

function calcKaldiracScore(kaldirac, nfbFavok, faizKoruma) {
  const sKal = scoreKaldiracVal(kaldirac);
  const sNfb = scoreNfbFavok(nfbFavok);
  const sFaiz = scoreFaizKoruma(faizKoruma);
  const score = 0.5 * sKal + 0.3 * sNfb + 0.2 * sFaiz;
  
  let status, detail;
  if (score >= 80) { status = 'Konservatif Yapı'; detail = `Kaldıraç: ${kaldirac?.toFixed(2) || '—'} — Düşük borç, güçlü özkaynak.`; }
  else if (score >= 60) { status = 'Dengeli'; detail = `Kaldıraç: ${kaldirac?.toFixed(2) || '—'} — Kabul edilebilir borç seviyesi.`; }
  else if (score >= 40) { status = 'Yüksek Kaldıraç'; detail = `Kaldıraç: ${kaldirac?.toFixed(2) || '—'} — Borç yükü artmaya başlamış.`; }
  else { status = 'Aşırı Borçlu'; detail = `Kaldıraç: ${kaldirac?.toFixed(2) || '—'} — İflas riski taşıyabilir!`; }

  return { score: parseFloat(score.toFixed(1)), status, detail, components: { kaldirac: parseFloat(sKal.toFixed(1)), nfb: parseFloat(sNfb.toFixed(1)), faiz: parseFloat(sFaiz.toFixed(1)) } };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. PİYASA RİSKİ SKORU (0-100)
// Formül: P = 0.4×VaR + 0.3×Vol + 0.2×Beta + 0.1×DD
// ═══════════════════════════════════════════════════════════════════════════

function scoreVaR(var95) {
  if (var95 == null) return 50;
  const varAbs = Math.abs(var95 / 100); // VaR yüzde olarak geliyor, orana çevir
  if (varAbs <= 0.02) return 100;
  if (varAbs <= 0.03) return 80;
  if (varAbs <= 0.05) return 60;
  if (varAbs <= 0.08) return 40;
  if (varAbs <= 0.12) return 20;
  return Math.max(0, 10 - (varAbs - 0.12) * 50);
}

function scoreVolatility(annualSigma) {
  if (annualSigma == null) return 50;
  const vol = annualSigma / 100; // Yüzde olarak geliyor
  if (vol <= 0.15) return 100;
  if (vol <= 0.25) return 100 - (vol - 0.15) * 500;
  if (vol <= 0.35) return 50 - (vol - 0.25) * 300;
  if (vol <= 0.50) return 20 - (vol - 0.35) * 133;
  return Math.max(0, 5 - (vol - 0.50) * 10);
}

function scoreBeta(beta) {
  if (beta == null) return 50;
  return Math.max(0, 100 - Math.abs(beta - 1.0) * 50);
}

function scoreDrawdown(maxDD) {
  if (maxDD == null) return 50;
  const ddAbs = Math.abs(maxDD / 100); // Yüzde olarak geliyor
  if (ddAbs <= 0.10) return 100;
  if (ddAbs <= 0.20) return 100 - (ddAbs - 0.10) * 500;
  if (ddAbs <= 0.30) return 50 - (ddAbs - 0.20) * 300;
  return Math.max(0, 20 - (ddAbs - 0.30) * 40);
}

function calcPiyasaScore(var95, annualSigma, beta, maxDrawdown) {
  const sVar = scoreVaR(var95);
  const sVol = scoreVolatility(annualSigma);
  const sBeta = scoreBeta(beta);
  const sDD = scoreDrawdown(maxDrawdown);
  const score = 0.4 * sVar + 0.3 * sVol + 0.2 * sBeta + 0.1 * sDD;

  let status, detail;
  if (score >= 80) { status = 'Düşük Volatilite'; detail = `VaR₉₅: ${var95}% — Kontrollü risk, sakin piyasa.`; }
  else if (score >= 60) { status = 'Normal Piyasa'; detail = `VaR₉₅: ${var95}% — Standart dalgalanma seviyesi.`; }
  else if (score >= 40) { status = 'Yükselen Volatilite'; detail = `VaR₉₅: ${var95}% — Dalgalanma artmakta.`; }
  else { status = 'Aşırı Volatilite'; detail = `VaR₉₅: ${var95}% — Sert fiyat hareketleri bekleniyor!`; }

  return { score: parseFloat(score.toFixed(1)), status, detail, components: { var95: parseFloat(sVar.toFixed(1)), volatilite: parseFloat(sVol.toFixed(1)), beta: parseFloat(sBeta.toFixed(1)), drawdown: parseFloat(sDD.toFixed(1)) } };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. TEKNİK RİSK SKORU (0-100)
// Formül: T = 0.5×ADX + 0.3×Trend + 0.2×Bollinger
// ═══════════════════════════════════════════════════════════════════════════

function scoreADX(adx) {
  if (adx == null) return 50;
  if (adx >= 30) return 100;
  if (adx >= 25) return 90;
  if (adx >= 20) return 75;
  if (adx >= 15) return 50;
  return Math.max(0, adx * 3.33);
}

function scoreTrend(trendScore) {
  // trendScore: 0-100 backend'den geliyor
  if (trendScore == null) return 50;
  return Math.max(0, Math.min(100, trendScore));
}

function scoreBollinger(bollingerScore) {
  if (bollingerScore == null) return 50;
  return Math.max(0, Math.min(100, bollingerScore));
}

function calcTeknikScore(indicators) {
  // ADX'i RSI'dan türet (proxy): RSI 30-70 arası güçlü trend göstergesi
  const rsiScore = indicators.rsi?.score || 50;
  const trendScore = indicators.trend?.score || 50;
  const bollingerScore = indicators.bollinger?.score || 50;
  const macdScore = indicators.macd?.score || 50;
  
  // ADX proxy: RSI uzaklığı 50'den + MACD gücü
  const rsiDeviation = Math.abs(rsiScore - 50);
  const adxProxy = Math.min(100, rsiDeviation * 1.5 + macdScore * 0.3);
  
  const sADX = Math.min(100, adxProxy);
  const sTrend = scoreTrend(trendScore);
  const sBollinger = scoreBollinger(bollingerScore);
  
  const score = 0.4 * sADX + 0.3 * sTrend + 0.3 * sBollinger;

  let status, detail;
  if (score >= 80) { status = 'Güçlü Trend'; detail = 'Teknik göstergeler güçlü yön sinyali veriyor.'; }
  else if (score >= 60) { status = 'Olumlu Teknik'; detail = 'Teknik yapı genel olarak olumlu.'; }
  else if (score >= 40) { status = 'Karışık Sinyaller'; detail = 'Teknik göstergeler karışık sinyal veriyor.'; }
  else { status = 'Olumsuz Teknik'; detail = 'Teknik yapı baskı altında, dikkatli olun.'; }

  return { score: parseFloat(score.toFixed(1)), status, detail, components: { adx: parseFloat(sADX.toFixed(1)), trend: parseFloat(sTrend.toFixed(1)), bollinger: parseFloat(sBollinger.toFixed(1)) } };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. MAKRO RİSK SKORU (0-100)
// Formül: M = 0.4×CDS + 0.4×VIX + 0.2×Kur
// ═══════════════════════════════════════════════════════════════════════════

function scoreCDS(cds) {
  if (cds == null) return 50;
  if (cds <= 200) return 100;
  if (cds <= 300) return 100 - (cds - 200) * 0.3;
  if (cds <= 400) return 70 - (cds - 300) * 0.4;
  if (cds <= 500) return 30 - (cds - 400) * 0.2;
  return Math.max(0, 10 - (cds - 500) * 0.02);
}

function scoreVIX(vix) {
  if (vix == null) return 50;
  if (vix <= 15) return 100;
  if (vix <= 20) return 100 - (vix - 15) * 4;
  if (vix <= 25) return 80 - (vix - 20) * 6;
  if (vix <= 30) return 50 - (vix - 25) * 8;
  return Math.max(0, 10 - (vix - 30) * 0.5);
}

function calcMakroScore(cds, vix) {
  const sCDS = scoreCDS(cds);
  const sVIX = scoreVIX(vix);
  // Kur etkisi — basit proxy olarak CDS kullan (CDS yüksekse TL baskı altında)
  const sKur = Math.min(100, sCDS * 0.6 + sVIX * 0.4);
  
  const score = 0.4 * sCDS + 0.4 * sVIX + 0.2 * sKur;

  let status, detail;
  if (score >= 80) { status = 'Sakin Piyasa'; detail = `CDS: ${cds} bps | VIX: ${vix} — Makro ortam destekleyici.`; }
  else if (score >= 60) { status = 'Normal Makro'; detail = `CDS: ${cds} bps | VIX: ${vix} — Standart koşullar.`; }
  else if (score >= 40) { status = 'Baskı Altında'; detail = `CDS: ${cds} bps | VIX: ${vix} — Makro riskler yükselişte.`; }
  else { status = 'Kriz Ortamı'; detail = `CDS: ${cds} bps | VIX: ${vix} — Panik/stres seviyesi yüksek!`; }

  return { score: parseFloat(score.toFixed(1)), status, detail, components: { cds: parseFloat(sCDS.toFixed(1)), vix: parseFloat(sVIX.toFixed(1)), kur: parseFloat(sKur.toFixed(1)) } };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 KADEME BİLGİLERİ
// ═══════════════════════════════════════════════════════════════════════════

const RISK_LEVELS = [
  {
    min: 0, max: 20,
    name: 'ÇOK KÖTÜ',
    subtitle: 'KRİTİK RİSK',
    emoji: '🔴',
    color: '#DC2626',
    bgColor: 'rgba(220, 38, 38, 0.12)',
    borderColor: 'rgba(220, 38, 38, 0.4)',
    tavsiye: 'SAT veya KAÇIN',
    aciklama: 'Portföyde varsa derhal çıkış planı yapın. Yeni pozisyon açmayın.',
    stopLoss: 'Mevcut fiyatın %5 altında kesin stop-loss uygula.',
    hedef: 'Zararı minimize etme odaklı, kâr hedefi yok.',
    kosullar: {
      likidite: 'Cari Oran < 1.0 veya Nakit akışı negatif',
      kaldirac: 'Kaldıraç > 4.0 veya NFB/FAVÖK > 4.0',
      piyasa: 'VaR₉₅ < -%5 (Günlük kayıp riski çok yüksek)',
      teknik: 'Trendsiz veya güçlü düşüş trendi',
      makro: 'CDS > 500 veya VIX > 35 (Piyasa panik)',
    },
  },
  {
    min: 20, max: 40,
    name: 'KÖTÜ',
    subtitle: 'YÜKSEK RİSK',
    emoji: '🟠',
    color: '#EA580C',
    bgColor: 'rgba(234, 88, 12, 0.12)',
    borderColor: 'rgba(234, 88, 12, 0.4)',
    tavsiye: 'AZALT veya BEKLE',
    aciklama: 'Mevcut pozisyonu %50 azaltın. Daha iyi seviyelerde yeniden değerlendirin.',
    stopLoss: 'Fiyatın %8 altında trailing stop.',
    hedef: 'Kısa vadeli tepki alımları için uygun, uzun vade riskli.',
    kosullar: {
      likidite: 'Cari Oran 1.0-1.5 (Sıkışma riski var)',
      kaldirac: 'Kaldıraç 3.0-4.0 (Yüksek borç)',
      piyasa: 'VaR₉₅ -%3 ile -%5 arası',
      teknik: 'Zayıf trend veya düşüş momentumu',
      makro: 'CDS 400-500 veya VIX 30-35',
    },
  },
  {
    min: 40, max: 60,
    name: 'NORMAL',
    subtitle: 'ORTA RİSK',
    emoji: '🟡',
    color: '#EAB308',
    bgColor: 'rgba(234, 179, 8, 0.12)',
    borderColor: 'rgba(234, 179, 8, 0.4)',
    tavsiye: 'BEKLE ve İZLE',
    aciklama: 'Pozisyonu koruyun, yeni ekleme yapmayın. Daha net sinyal bekleyin.',
    stopLoss: 'Fiyatın %10 altında stop.',
    hedef: 'Trend netleşene kadar nötr pozisyon.',
    kosullar: {
      likidite: 'Cari Oran 1.5-2.0 (Yeterli ama mükemmel değil)',
      kaldirac: 'Kaldıraç 2.0-3.0 (Kabul edilebilir)',
      piyasa: 'VaR₉₅ -%2 ile -%3 arası',
      teknik: 'Orta güçte trend veya yatay konsolidasyon',
      makro: 'CDS 300-400 veya VIX 25-30',
    },
  },
  {
    min: 60, max: 80,
    name: 'İYİ',
    subtitle: 'DÜŞÜK RİSK',
    emoji: '🟢',
    color: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
    tavsiye: 'AL veya TUT',
    aciklama: 'Yeni pozisyon açılabilir. Mevcut pozisyonlar korunmalı.',
    stopLoss: 'Fiyatın %12 altında stop.',
    hedef: 'Hedef fiyata kadar tutun, kademeli alım yapılabilir.',
    kosullar: {
      likidite: 'Cari Oran 2.0-2.5 (Güçlü likidite)',
      kaldirac: 'Kaldıraç 1.5-2.0 (Konservatif)',
      piyasa: 'VaR₉₅ -%1 ile -%2 arası (Kontrollü)',
      teknik: 'Güçlü trend + Momentum pozitif',
      makro: 'CDS 200-300 veya VIX 20-25',
    },
  },
  {
    min: 80, max: 100,
    name: 'ÇOK İYİ',
    subtitle: 'MİNİMAL RİSK',
    emoji: '🔵',
    color: '#15803D',
    bgColor: 'rgba(21, 128, 61, 0.12)',
    borderColor: 'rgba(21, 128, 61, 0.4)',
    tavsiye: 'GÜÇLÜ AL',
    aciklama: 'Agresif alım yapılabilir. Portföy ağırlığı artırılabilir.',
    stopLoss: 'Fiyatın %15 altında stop (geniş tolerans).',
    hedef: 'Uzun vade tutma, kademeli alım stratejisi uygula.',
    kosullar: {
      likidite: 'Cari Oran > 2.5 (Mükemmel nakit durumu)',
      kaldirac: 'Kaldıraç < 1.5 (Düşük borç)',
      piyasa: 'VaR₉₅ > -%1 (Düşük volatilite)',
      teknik: 'ADX > 30 + Güçlü yükseliş + Golden Cross',
      makro: 'CDS < 200 veya VIX < 20 (Sakin piyasa)',
    },
  },
];

function getRiskLevel(score) {
  for (const level of RISK_LEVELS) {
    if (score >= level.min && score < level.max) return level;
  }
  return RISK_LEVELS[RISK_LEVELS.length - 1]; // 100 = ÇOK İYİ
}

// ═══════════════════════════════════════════════════════════════════════════
// ANA FONKSİYON: Tüm risk skorlarını hesapla ve birleştir
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 5 Kademeli Risk Skoru hesapla
 * @param {Object} params - Tüm analiz verileri
 * @returns {Object} - Toplam skor, seviye, bileşen detayları
 */
export function calculateRiskLevel({
  // Likidite parametreleri
  cariOran = null,
  asitTest = null,
  nakitDonusum = null,
  // Kaldıraç parametreleri
  kaldirac = null,
  nfbFavok = null,
  faizKoruma = null,
  // Piyasa parametreleri (riskReport'tan)
  var95 = null,
  annualSigma = null,
  beta = null,
  maxDrawdown = null,
  // Teknik parametreler (indicators'dan)
  indicators = {},
  // Makro parametreler
  cds = null,
  vix = null,
}) {
  // 5 bileşeni hesapla
  const likidite = calcLikiditeScore(cariOran, asitTest, nakitDonusum);
  const kaldiracResult = calcKaldiracScore(kaldirac, nfbFavok, faizKoruma);
  const piyasa = calcPiyasaScore(var95, annualSigma, beta, maxDrawdown);
  const teknik = calcTeknikScore(indicators);
  const makro = calcMakroScore(cds, vix);

  // Ağırlıklı toplam skor
  const totalScore = parseFloat((
    WEIGHTS.likidite * likidite.score +
    WEIGHTS.kaldirac * kaldiracResult.score +
    WEIGHTS.piyasa * piyasa.score +
    WEIGHTS.teknik * teknik.score +
    WEIGHTS.makro * makro.score
  ).toFixed(1));

  const level = getRiskLevel(totalScore);

  return {
    totalScore,
    level: {
      name: level.name,
      subtitle: level.subtitle,
      emoji: level.emoji,
      color: level.color,
      bgColor: level.bgColor,
      borderColor: level.borderColor,
      tavsiye: level.tavsiye,
      aciklama: level.aciklama,
      stopLoss: level.stopLoss,
      hedef: level.hedef,
      kosullar: level.kosullar,
    },
    components: {
      likidite: { weight: WEIGHTS.likidite, ...likidite },
      kaldirac: { weight: WEIGHTS.kaldirac, ...kaldiracResult },
      piyasa: { weight: WEIGHTS.piyasa, ...piyasa },
      teknik: { weight: WEIGHTS.teknik, ...teknik },
      makro: { weight: WEIGHTS.makro, ...makro },
    },
    formula: `RSK = ${WEIGHTS.likidite}×${likidite.score} + ${WEIGHTS.kaldirac}×${kaldiracResult.score} + ${WEIGHTS.piyasa}×${piyasa.score} + ${WEIGHTS.teknik}×${teknik.score} + ${WEIGHTS.makro}×${makro.score} = ${totalScore}`,
    weights: WEIGHTS,
  };
}

import { fetchStockPrices } from './yahooFinance.js';
import { calculateRSI, calculateMACD, calculateSMA, calculateBollinger, calculateEMA, calculateStochastic, calculateADX, calculateMFI, calculateFibonacci, calculateSupportResistance } from './technical.js';
import { getMacroData } from './macroData.js';
import { findOptimalD, calcOFI } from './fracDiff.js';
import { detectRegime } from './regimeDetector.js';
import { calcRiskReport } from './riskAnalytics.js';
import { softPolicy, calcMultiObjectiveReward } from './hrpOptimizer.js';
import { analyzeCompanyFundamentals } from './fundamentalAnalysis.js';
import { generateFullPredictions, calculateImpactAnalysis, generatePipelineSteps } from './prediction.js';
import { savePrediction, getPredictionHistory } from './predictionHistory.js';
import { calculateRiskLevel } from './riskLevel.js';
import { calculatePriceImpact } from './priceImpact.js';
import prisma from '../lib/prisma.js';

/**
 * RSI yorumu
 */
function interpretRSI(rsi) {
  if (rsi === null) return { status: 'veri yok', color: 'gray', score: 50, comment: 'Yeterli veri yok.' };
  if (rsi < 20) return { status: 'Aşırı Satış', color: 'green', score: 85, comment: `RSI ${rsi.toFixed(1)} — Hisse ciddi şekilde aşırı satış bölgesinde. Teknik geri dönüş için hazır.` };
  if (rsi < 35) return { status: 'Düşük', color: 'green', score: 70, comment: `RSI ${rsi.toFixed(1)} — Hisse ucuz bölgede. Alım için uygun sinyal.` };
  if (rsi < 50) return { status: 'Nötr (Zayıf)', color: 'yellow', score: 55, comment: `RSI ${rsi.toFixed(1)} — Momentum zayıf ama satış baskısı da sınırlı.` };
  if (rsi < 65) return { status: 'Nötr (Güçlü)', color: 'yellow', score: 50, comment: `RSI ${rsi.toFixed(1)} — Hisse makul momentum sergilemekte, izlemeye alın.` };
  if (rsi < 80) return { status: 'Aşırı Alış', color: 'red', score: 25, comment: `RSI ${rsi.toFixed(1)} — Hisse pahalı bölgede. Kâr realizasyonu riski var.` };
  return { status: 'Kritik Aşırı Alış', color: 'red', score: 10, comment: `RSI ${rsi.toFixed(1)} — Tarihi aşırı alış seviyesi. Sert düzeltme gelebilir.` };
}

/**
 * MACD yorumu
 */
function interpretMACD(macd) {
  if (!macd) return { status: 'veri yok', color: 'gray', score: 50, comment: 'MACD için yeterli veri yok (26 gün gerekli).' };
  const { macd: line, signal, hist } = macd;
  if (hist > 0 && line > 0) return { status: 'Güçlü Yükseliş', color: 'green', score: 80, comment: `MACD (${line.toFixed(2)}) > Signal (${signal.toFixed(2)}) ve pozitif bölgede. Güçlü yukarı momentum devam ediyor.` };
  if (hist > 0 && line < 0) return { status: 'Dönüş Sinyali', color: 'cyan', score: 70, comment: `MACD Signal hattını yukarı kesti (hist: +${hist.toFixed(2)}). Negatif bölgeden çıkış başlıyor.` };
  if (hist < 0 && line < 0) return { status: 'Düşüş Trendi', color: 'red', score: 25, comment: `MACD (${line.toFixed(2)}) negatif ve Signal altında. Düşüş momentumu sürüyor.` };
  return { status: 'Zayıflıyor', color: 'yellow', score: 40, comment: `MACD sinyali kesti ama güç kaybediyor (hist: ${hist.toFixed(2)}). Dikkatli izleyin.` };
}

/**
 * SMA Golden/Death Cross yorumu
 */
function interpretSMA(sma20, sma50, currentPrice) {
  if (!sma20 || !sma50) return { status: 'veri yok', color: 'gray', score: 50, comment: 'SMA hesabı için yeterli veri yok.' };
  const cross = sma20 > sma50;
  const priceAbove20 = currentPrice > sma20;
  if (cross && priceAbove20) return { status: 'Golden Cross ✓', color: 'green', score: 80, comment: `SMA20 (${sma20.toFixed(2)}) > SMA50 (${sma50.toFixed(2)}) — Altın kesişim aktif. Fiyat destek üzerinde.` };
  if (cross && !priceAbove20) return { status: 'Destek Altı', color: 'yellow', score: 45, comment: `SMA20 > SMA50 ama fiyat (${currentPrice.toFixed(2)}) SMA20'nin altında. Geçici zayıflık.` };
  if (!cross && !priceAbove20) return { status: 'Death Cross ✗', color: 'red', score: 20, comment: `SMA20 (${sma20.toFixed(2)}) < SMA50 (${sma50.toFixed(2)}) — Ölüm kesişimi. Fiyat kritik altında.` };
  return { status: 'Direnç Testi', color: 'yellow', score: 50, comment: `Fiyat SMA20'nin üstünde ama golden cross oluşmadı. Trend değişimi izlenecek.` };
}

/**
 * Bollinger Bands yorumu
 */
function interpretBollinger(bollinger, currentPrice) {
  if (!bollinger || !currentPrice) return { status: 'veri yok', color: 'gray', score: 50, comment: 'Bollinger hesaplaması için yeterli veri yok.' };
  const { upper, middle, lower, width } = bollinger;
  const position = (currentPrice - lower) / (upper - lower) * 100;
  if (currentPrice <= lower) return { status: 'Alt Band Altı 🔔', color: 'green', score: 85, comment: `Fiyat (${currentPrice.toFixed(2)}) alt band (${lower.toFixed(2)}) altında. Güçlü teknik dönüş noktası.` };
  if (position < 25) return { status: 'Alt Bölge', color: 'green', score: 70, comment: `Fiyat Bollinger alt bölgesinde (%${position.toFixed(0)} konumunda). Alım fırsatı yakın.` };
  if (position > 85) return { status: 'Üst Bölge', color: 'red', score: 30, comment: `Fiyat Bollinger üst bölgesinde (%${position.toFixed(0)} konumunda). Aşırı alım riski.` };
  if (currentPrice >= upper) return { status: 'Üst Band Üstü 🔔', color: 'red', score: 15, comment: `Fiyat (${currentPrice.toFixed(2)}) üst band (${upper.toFixed(2)}) üzerinde. Düzeltme riski yüksek.` };
  return { status: 'Orta Bölge', color: 'yellow', score: 50, comment: `Fiyat Bollinger orta bölgesinde (SMA: ${middle.toFixed(2)}). Yön bekleniyor.` };
}

/**
 * Volume analizi (son 5 gün vs önceki 20 gün ortalaması)
 */
function interpretVolume(priceData) {
  if (priceData.length < 25) return { status: 'veri yok', color: 'gray', score: 50, comment: 'Hacim analizi için yeterli veri yok.' };
  const recent5 = priceData.slice(-5);
  const prev20 = priceData.slice(-25, -5);
  const avgRecent = recent5.reduce((s, p) => s + (p.volume || 0), 0) / 5;
  const avgPrev = prev20.reduce((s, p) => s + (p.volume || 0), 0) / 20;
  const ratio = avgPrev > 0 ? avgRecent / avgPrev : 1;
  if (ratio > 2) return { status: 'Patlama 🔥', color: 'cyan', score: 75, comment: `Son 5 günlük hacim ortalaması, önceki 20 günün ${ratio.toFixed(1)}x'i. Büyük ilgi var.` };
  if (ratio > 1.3) return { status: 'Artan', color: 'green', score: 65, comment: `Hacim normalin %${((ratio-1)*100).toFixed(0)} üzerinde. Kurumsallar dikkat çekebilir.` };
  if (ratio < 0.5) return { status: 'Çok Düşük', color: 'red', score: 35, comment: `Hacim historik ortalamanın çok altında. Likidite riski mevcut.` };
  if (ratio < 0.8) return { status: 'Düşük', color: 'yellow', score: 45, comment: `Hacim normale göre %${((1-ratio)*100).toFixed(0)} düşük. İlgi azalmış.` };
  return { status: 'Normal', color: 'gray', score: 55, comment: `Hacim normal seviyelerde (${ratio.toFixed(1)}x). Piyasa dengeli.` };
}

/**
 * Trend gücü (fiyatın son 20 içindeki konumu)
 */
function interpretTrend(priceData) {
  if (priceData.length < 20) return { status: 'veri yok', color: 'gray', score: 50, comment: 'Trend analizi için yeterli veri yok.' };
  const slice = priceData.slice(-20);
  const max = Math.max(...slice.map(p => p.close));
  const min = Math.min(...slice.map(p => p.close));
  const current = slice[slice.length - 1].close;
  const position = (current - min) / (max - min) * 100;
  if (position >= 85) return { status: '52 Hafta Zirvesi Yakın', color: 'green', score: 75, comment: `Fiyat 20 günlük zirveye çok yakın (zirvenin %${(100-position).toFixed(0)} altında). Güçlü trend.` };
  if (position >= 60) return { status: 'Yükselen Trend', color: 'green', score: 65, comment: `Fiyat 20 günlük aralığın üst yarısında. Trend yukarı.` };
  if (position <= 15) return { status: '52 Hafta Dibi Yakın', color: 'red', score: 30, comment: `Fiyat 20 günlük dibin yakınında (dibin %${position.toFixed(0)} üstünde). Zayıf trend.` };
  if (position <= 40) return { status: 'Düşen Trend', color: 'red', score: 38, comment: `Fiyat 20 günlük aralığın alt yarısında. Satış baskısı var.` };
  return { status: 'Yatay', color: 'yellow', score: 50, comment: `Fiyat 20 günlük aralığın ortasında. Yatay konsolidasyon.` };
}

/**
 * Genel AI yorumu üret (ÇOK DETAYLI VE EĞİTİCİ EKSİKSİZ FORMAT)
 */
function generateAICommentary(data) {
  const { rsi, macd: macdInterp, sma, bollinger, volume, trend, macroData, finalScore, signal, priceImpact, currentPrice } = data;
  
  const extractImpact = (factorName) => {
    if (!priceImpact || !priceImpact.categories) return null;
    for (const cat of priceImpact.categories) {
      const match = cat.factors.find(f => f.name.toLowerCase().includes(factorName.toLowerCase()));
      if (match) return match;
    }
    return null;
  };

  const lines = [];

  // 1. Ana Karar Özeti
  lines.push(`🎯 **KAPSANLI YZ STRATEJİ VE YÖN KARARI**`);
  if (signal.includes('GÜÇLÜ AL') || signal.includes('GUCLU AL')) {
    lines.push(`Genel Yön: **GÜÇLÜ AL SİNYALİ**. Algoritmamız tüm zaman dilimlerinde güçlü bir yukarı hacim tespit etti. Bu aşamada düşüşler alım fırsatı olarak değerlendirilebilir.`);
  } else if (signal.includes('AL')) {
    lines.push(`Genel Yön: **AL SİNYALİ**. Temel indikatörler pozitif. Görece güvenli bir giriş pozisyonunda.`);
  } else if (signal.includes('SAT')) {
    lines.push(`Genel Yön: **SAT SİNYALİ**. Negatif metrikler çoğunlukta. Mevcut pozisyonların gözden geçirilmesi ve küçültülmesi önerilir.`);
  } else if (signal.includes('GÜÇLÜ SAT') || signal.includes('GUCLU SAT')) {
    lines.push(`Genel Yön: **GÜÇLÜ SAT SİNYALİ**. Ciddi riskler taşıyor. Teknik kırılımlar veya yoğun satış baskısı var, alımdan uzak durulmalı.`);
  } else {
    lines.push(`Genel Yön: **BEKLE (NÖTR)**. Hisse fiyatı kararsız bir bölgede. Yeni bir aksiyon almadan önce trendin netleşmesi beklenmelidir.`);
  }
  lines.push(`\n---\n`);

  // 2. Teknik Eğitici ve Detaylı Durumlar
  lines.push(`📚 **TEKNİK İNDİKATÖR ANALİZLERİ VE BEKLENEN FİYAT ETKİLERİ**`);
  
  // RSI
  const rsiImpact = extractImpact('RSI');
  lines.push(`\n**1. RSI (Göreceli Güç Endeksi) Nedir?**
_Nasıl Çalışır:_ RSI, fiyatın hızını ve yönünü ölçen 0-100 arası bir osilatördür. 30'un altı hissenin "Aşırı Satıldığını" (ucuzladığını), 70'in üstü ise "Aşırı Alındığını" (pahalandığını) gösterir.
_Hissedeki Durum:_ ${rsi.comment}
_Beklenen Fiyat Etkisi:_ Yön **${rsiImpact && rsiImpact.impactPct >= 0 ? '+' : '-'}** | Tahmini Değişim Etkisi: **%${rsiImpact ? Math.abs(rsiImpact.impactPct).toFixed(2) : '0.00'}**`);

  // MACD
  const macdImp = extractImpact('MACD');
  lines.push(`\n**2. MACD (Hareketli Ortalamalar Yakınsaması) Nedir?**
_Nasıl Çalışır:_ İki farklı hareketli ortalamanın (genelde 12 ve 26 günlük) birbiriyle olan ilişkisini ölçer. MACD çizgisi Sinyal çizgisini yukarı keserse "AL", aşağı keserse "SAT" anlamına gelir.
_Hissedeki Durum:_ ${macdInterp.comment}
_Beklenen Fiyat Etkisi:_ Yön **${macdImp && macdImp.impactPct >= 0 ? '+' : '-'}** | Tahmini Değişim Etkisi: **%${macdImp ? Math.abs(macdImp.impactPct).toFixed(2) : '0.00'}**`);

  // SMA (Golden/Death Cross)
  const smaImp = extractImpact('Trend');
  lines.push(`\n**3. SMA (Hareketli Ortalamalar - Golden/Death Cross) Nedir?**
_Nasıl Çalışır:_ Kısa vadeli (50 günlük) hareketli ortalamanın, uzun vadeli (200 veya 100 günlük) hareketli ortalamayı aşağıdan yukarı kesmesine Golden Cross (Güçlü Yükseliş); yukarıdan aşağı kesmesine Death Cross (Güçlü Düşüş) denir.
_Hissedeki Durum:_ ${sma.comment}
_Beklenen Fiyat Etkisi:_ Yön **${smaImp && smaImp.impactPct >= 0 ? '+' : '-'}** | Tahmini Değişim Etkisi: **%${smaImp ? Math.abs(smaImp.impactPct).toFixed(2) : '0.00'}**`);

  // Bollinger
  const bolImp = extractImpact('Bollinger');
  lines.push(`\n**4. Bollinger Bantları Nedir?**
_Nasıl Çalışır:_ Fiyatın volatilitesini ölçen bantlardır. Fiyat üst banda değerse hissenin aşırı değerlendiği, alt banda değerse çok ucuzladığı ve tepki alımı geleceği düşünülür.
_Hissedeki Durum:_ ${bollinger.comment}
_Beklenen Fiyat Etkisi:_ Yön **${bolImp && bolImp.impactPct >= 0 ? '+' : '-'}** | Tahmini Değişim Etkisi: **%${bolImp ? Math.abs(bolImp.impactPct).toFixed(2) : '0.00'}**`);

  // Hacim
  lines.push(`\n**5. Hacim (Volume) Analizi Nedir?**
_Nasıl Çalışır:_ Hacim, hissede dönen para miktarıdır. Bir yükseliş veya düşüş yüksek hacimle gerçekleşiyorsa işlem "onaylanmış" (güvenilir) sayılır. Sığ hacimli hareketler genelde tuzaktır.
_Hissedeki Durum:_ ${volume.comment}`);

  // Stochastic
  if (data.stochastic) {
    const stoch = data.stochastic;
    const stochSignalMap = { oversold: 'Aşırı Satım — Güçlü dönüş sinyali', overbought: 'Aşırı Alım — Düzeltme riski', bullish_cross: 'Yukarı Kesişim — Alım sinyali', bearish_cross: 'Aşağı Kesişim — Satış sinyali', neutral: 'Nötr bölgede' };
    lines.push(`\n**6. Stochastic Oscillator Nedir?**
_Nasıl Çalışır:_ Fiyatın belirli bir dönemdeki en yüksek ve en düşük değerlere göre kapanış konumunu ölçer. %K ve %D çizgileri kullanılır. 20 altı aşırı satım, 80 üstü aşırı alımdır.
_Hissedeki Durum:_ %K: ${stoch.k}, %D: ${stoch.d} — ${stochSignalMap[stoch.signal] || 'Nötr'}`);
  }

  // ADX
  if (data.adx) {
    const adx = data.adx;
    lines.push(`\n**7. ADX (Ortalama Yönlü Endeks) Nedir?**
_Nasıl Çalışır:_ ADX trendin gücünü ölçer (yönünü değil). 25 üzeri güçlü trend, 20 altı zayıf/yatay piyasa demektir. DI+ > DI- ise yükseliş trendi, tersi düşüş trendi.
_Hissedeki Durum:_ ADX: ${adx.adx}, DI+: ${adx.diPlus}, DI-: ${adx.diMinus} — Trend Gücü: **${adx.trendStrength}** | Yön: **${adx.direction === 'bullish' ? 'Yükseliş' : 'Düşüş'}**`);
  }

  // MFI
  if (data.mfi) {
    const mfi = data.mfi;
    lines.push(`\n**8. MFI (Para Akış Endeksi) Nedir?**
_Nasıl Çalışır:_ MFI, hacim ağırlıklı RSI'dır. Hem fiyat hem hacim bilgisini birleştirir. 20 altı güçlü alım fırsatı, 80 üstü satış baskısı sinyalidir.
_Hissedeki Durum:_ MFI: ${mfi.mfi} — ${mfi.signal === 'oversold' ? 'Aşırı Satım (Alım fırsatı)' : mfi.signal === 'overbought' ? 'Aşırı Alım (Kâr realizasyonu)' : 'Normal akış'}`);
  }

  // Fibonacci
  if (data.fibonacci) {
    const fib = data.fibonacci;
    lines.push(`\n**9. Fibonacci Geri Çekilme Seviyeleri Nedir?**
_Nasıl Çalışır:_ Fibonacci seviyeleri, fiyatın bir ralliden sonra ne kadar geri çekileceğini tahmin eder. %38.2, %50 ve %61.8 en önemli destek/direnç seviyeleridir.
_Hissedeki Durum:_ Fiyat **${fib.zone === 'support_zone' ? 'destek bölgesinde' : fib.zone === 'resistance_zone' ? 'direnç bölgesinde' : fib.zone === 'deep_retracement' ? 'derin geri çekilmede' : 'orta bölgede'}**. En yakın Fibonacci: ${fib.closestLevel?.level} (${fib.closestLevel?.price} TL)`);
  }

  // Destek/Direnç
  if (data.supportResistance) {
    const sr = data.supportResistance;
    lines.push(`\n**10. Destek/Direnç Seviyeleri Nedir?**
_Nasıl Çalışır:_ Fiyatın sıklıkla geri döndüğü seviyeleri belirler. Destek: fiyatın düşüşte durduğu seviye. Direnç: yükselişte durduğu seviye.
_Hissedeki Durum:_ En yakın Destek: **${sr.closestSupport || 'Yok'} TL** | En yakın Direnç: **${sr.closestResistance || 'Yok'} TL** | Pivot: **${sr.pivotPoints?.pivot} TL**`);
  }

  lines.push(`\n---\n`);
  
  // 3. Toplam Analiz Özeti ve Puan
  lines.push(`🛡️ **GENEL RİSK VE MAKRO FAKTÖRLER**`);
  const cdsValue = macroData?.cds ?? '—';
  const vixValue = macroData?.vix ?? '—';
  lines.push(`Bu hisseyi etkileyen dış faktörlere bakıldığında; Türkiye CDS risk primleri (${cdsValue} bps) ve Küresel VIX Korku Endeksi (${vixValue}) baz alındığında sistemimiz piyasa geneli için ${(macroData?.cds ?? 0) > 300 ? 'belirli makro riskler seziyor' : 'olumlu, sakin bir makro çevre tespit etmiştir'}.`);
  if (priceImpact && priceImpact.fairValue != null) {
      lines.push(`\n💡 **Nihai Model Çıktısı:** Bu değişkenler ışığında hissenin ideal / adil değerinin **${priceImpact.fairValue.toFixed(2)} TL** olabileceği hesaplanmış olup, toplam formül etkimiz fiyat yönünde **${priceImpact.totalImpactPct > 0 ? '+' : ''}${priceImpact.totalImpactPct}%** olarak saptanmıştır.`);
  }

  return lines.join('\n');
}

// Bellek içi basit önbellek (Sistem açıkken çok hızlı yanıt için)
const memCache = new Map();

/**
 * Ana analiz fonksiyonunun önbellekli versiyonu
 */
export async function getAnalyzeStock(ticker, period = '3mo', force = false) {
  const cacheKey = `${ticker}-${period}`;
  
  // 1. Memory cache kontrol (force=true ise atla)
  const memData = memCache.get(cacheKey);
  if (!force && memData && (Date.now() - memData.ts < 5 * 60 * 1000)) {
    return memData.result;
  }

  // 2. DB (Persisted) cache kontrol (SignalHistory üzerinden)
  if (!force) {
    const dbCache = await prisma.signalHistory.findFirst({
      where: { ticker: ticker.toUpperCase() },
      orderBy: { createdAt: 'desc' }
    }).catch(() => null);

    if (dbCache && dbCache.details) {
      try {
        const cachedResult = JSON.parse(dbCache.details);
        // Eğer veri 1 saatten yeniyse direkt döndür (Stale-While-Revalidate tetiklemeden)
        if (Date.now() - new Date(dbCache.createdAt).getTime() < 60 * 60 * 1000) {
          return cachedResult;
        }
        
        // Eğer veri eski ise, arka planda güncellerken ESKİ veriyi döndür (Kullanıcı bekletilmez)
        analyzeAndCache(ticker, period).catch(console.error);
        return cachedResult;
      } catch (e) {
        console.warn("Cache parse hatası:", e);
      }
    }
  }

  // 3. İlk defa açılıyorsa veya cache yoksa mecbur bekle
  return await analyzeAndCache(ticker, period);
}

async function analyzeAndCache(ticker, period) {
  const result = await analyzeStock(ticker, period);
  
  // Önbelleğe kaydet
  memCache.set(`${ticker}-${period}`, { ts: Date.now(), result });
  
  // DB'ye kaydet (SignalHistory)
  await prisma.signalHistory.create({
    data: {
      ticker: ticker.toUpperCase(),
      signal: result.signal,
      score: result.finalScore,
      price: result.currentPrice || 0,
      details: JSON.stringify(result)
    }
  }).catch(err => console.error("Cache save hatası:", err));

  return result;
}

/**
 * Ana analiz fonksiyonu - v5.0 (7 Kademeli + Tahmin + Pipeline + Impact)
 */
export async function analyzeStock(ticker, period = '3mo') {
  // Tahmin için uzun veri lazım - fallback olarak normal period kullan
  const longPeriod = period === '1mo' ? '6mo' : period === '3mo' ? '1y' : period === '6mo' ? '2y' : '2y';
  
  const { priceData, currentPrice } = await fetchStockPrices(ticker, period);
  
  if (!priceData || priceData.length < 14) {
    throw new Error(`${ticker} için yeterli fiyat verisi bulunamadı.`);
  }

  // Uzun vade verisi (tahminler için) - hata olursa priceData'yı kullan
  let longTermData = { priceData: [] };
  try {
    longTermData = await fetchStockPrices(ticker, longPeriod);
  } catch (e) {
    console.warn(`${ticker} uzun vade verisi alınamadı, mevcut veri ile devam ediliyor.`);
  }

  const closes = priceData.map(p => p.close);

  // ─── Veritabanından temel veri çek ─────────────────────────────────────────
  let stockRecord = await prisma.stock.findUnique({
    where: { ticker: ticker.toUpperCase() },
    include: { ratios: true, fundamental: { orderBy: { period: 'desc' }, take: 2 } }
  }).catch(() => null);

  // Otomatik ekleme (Auto-Discovery) - Eğer veritabanında yoksa ama Yahoo'dan geldiyse DB'ye yaz
  if (!stockRecord && priceData && priceData.length > 0) {
    try {
      stockRecord = await prisma.stock.create({
        data: {
          ticker: ticker.toUpperCase(),
          name: ticker.toUpperCase() + ' (Otomatik Eklendi)',
          type: ticker.includes('-USD') ? 'crypto' : ticker.includes('=X') ? 'forex' : 'bist', // Tahmini tip ataması
          exchange: ticker.includes('-USD') ? 'CCC' : 'IS',
          currency: ticker.includes('-USD') ? 'USD' : 'TRY',
          source: 'yahoo',
          marketCap: 0,
          sector: 'Unknown',
          industry: 'Unknown',
          description: 'Sistem tarafından ilk analiz esnasında otomatik araştırılıp keşfedildi.',
          isActive: true
        },
        include: { ratios: true, fundamental: true }
      });
      console.log(`[Auto-Discovery] Yeni varlık sisteme eklendi: ${ticker}`);
    } catch (e) {
      console.warn(`[Auto-Discovery] Varlık eklenirken hata: ${ticker}`, e.message);
    }
  }

  const stockRatios = stockRecord?.ratios || null;
  const fundamentals = stockRecord?.fundamental || [];
  const sector = stockRecord?.sector || 'Unknown';

  // ─── KADEME 1: Veri Füzyonu ───────────────────────────────────────────────
  const fracDiffResult = closes.length >= 20 ? findOptimalD(closes) : { d: 0.5, memoryRetained: 50 };
  const ofiResult = calcOFI(priceData);

  // ─── Teknik İndikatörler ──────────────────────────────────────────────────
  const rsi14Raw = calculateRSI(priceData);
  const macdRaw = calculateMACD(priceData);
  const sma20Raw = calculateSMA(priceData, 20);
  const sma50Raw = calculateSMA(priceData, 50);
  const ema12Raw = calculateEMA(priceData, 12);
  const ema26Raw = calculateEMA(priceData, 26);
  const bollingerRaw = calculateBollinger(priceData);
  const stochasticRaw = calculateStochastic(priceData);
  const adxRaw = calculateADX(priceData);
  const mfiRaw = calculateMFI(priceData);
  const fibonacciRaw = calculateFibonacci(priceData);
  const supportResistanceRaw = calculateSupportResistance(priceData);

  const rsiInterp = interpretRSI(rsi14Raw);
  const macdInterp = interpretMACD(macdRaw);
  const smaInterp = interpretSMA(sma20Raw, sma50Raw, currentPrice);
  const bollingerInterp = interpretBollinger(bollingerRaw, currentPrice);
  const volumeInterp = interpretVolume(priceData);
  const trendInterp = interpretTrend(priceData);

  // ─── KADEME 3: Rejim Tespiti (HMM) ───────────────────────────────────────
  const regime = detectRegime(priceData);
  // Dinamik ağırlıklar [Tech, Fundamental, Makro, Sentiment]
  const [wTech, wFund, wMacro, wSent] = regime.dynamicWeights;

  // ─── Makro ────────────────────────────────────────────────────────────────
  const macro = await getMacroData();
  let macroScoreVal = 50;
  if (macro.cds < 200) macroScoreVal = 75;
  else if (macro.cds < 300) macroScoreVal = 60;
  else if (macro.cds > 400) macroScoreVal = 30;
  if (macro.vix < 20) macroScoreVal = Math.min(100, macroScoreVal + 15);
  else if (macro.vix > 30) macroScoreVal = Math.max(0, macroScoreVal - 15);

  // ─── KADEME 4: Risk Analizi ───────────────────────────────────────────────
  const riskReport = calcRiskReport(priceData);
  const riskScore = riskReport.riskScore || 50;

  // Teknik alt skor
  // Stochastic ve ADX skorlarını hesapla
  const stochScore = stochasticRaw ? (stochasticRaw.signal === 'oversold' ? 80 : stochasticRaw.signal === 'overbought' ? 20 : stochasticRaw.signal === 'bullish_cross' ? 70 : stochasticRaw.signal === 'bearish_cross' ? 30 : 50) : 50;
  const adxScore = adxRaw ? (adxRaw.isTrending && adxRaw.direction === 'bullish' ? 70 : adxRaw.isTrending && adxRaw.direction === 'bearish' ? 30 : 50) : 50;
  const mfiScore = mfiRaw ? (mfiRaw.signal === 'oversold' ? 80 : mfiRaw.signal === 'overbought' ? 20 : mfiRaw.signal === 'weak' ? 60 : mfiRaw.signal === 'strong' ? 35 : 50) : 50;

  // v2.0 Optimize ağırlıklar: ADX ve MFI ağırlıkları artırıldı, RSI azaltıldı
  // Literatür bazlı optimal dağılım
  const techScore = (rsiInterp.score * 0.20) + (macdInterp.score * 0.18) + (smaInterp.score * 0.12) + (bollingerInterp.score * 0.12) + (stochScore * 0.12) + (adxScore * 0.13) + (mfiScore * 0.13);
  
  // OFI skoru tekniğe dahil (küçük ağırlıkla)
  const adjustedTechScore = techScore * 0.90 + ofiResult.score * 0.10;
  // ─── PPTX Temel Analiz ──────────────────────────────────────────────────────
  const fundamentalAnalysis = analyzeCompanyFundamentals(stockRatios, fundamentals, sector, regime.regimeName);
  const fundScore = fundamentalAnalysis.combined.score; // Gerçek temel skor (0-100)

  // ─── Birleşik Skor - Rejime Göre Dinamik Ağırlıklar ─────────────────────
  // SignalScore = w_tech*Tech + w_fund*Fund + w_macro*Macro + w_sent*Sent
  const sentScore = volumeInterp.score; // Hacim ≈ Sentiment proxy
  
  // NaN koruması: Her alt skor NaN/undefined ise 50 (nötr) kullan
  const safeScore = (v) => (typeof v === 'number' && !isNaN(v)) ? v : 50;
  
  const rawScore = (safeScore(adjustedTechScore) * wTech) + 
                   (safeScore(fundScore) * wFund) + 
                   (safeScore(macroScoreVal) * wMacro) + 
                   (safeScore(sentScore) * wSent);
  
  // Risk ayarı: Yüksek tail risk final skoru düşürür
  const riskAdjustment = (riskReport.xi > 0.3) ? -5 : (riskReport.xi < 0.15) ? +3 : 0;
  const finalScore = Math.max(0, Math.min(100, Math.round(safeScore(rawScore) + riskAdjustment)));

  // ─── KADEME 5: G-Learning Soft Policy ────────────────────────────────────
  const regimeKeyMap = { 0: 'calm', 1: 'crisis', 2: 'highVol' };
  const gPolicy = softPolicy(finalScore, 0.1, regime.probabilities.crisis);

  // Karar formülü: VaR ayarlı nihai karar
  let signal;
  const var95 = riskReport.var95;
  if (finalScore >= 75 && (var95 === null || var95 > -3.0)) signal = 'GÜÇLÜ AL';
  else if (finalScore >= 60) signal = 'AL';
  else if (finalScore >= 45) signal = 'BEKLE';
  else if (regime.probabilities.crisis > 0.6) signal = 'GÜÇLÜ SAT';
  else signal = 'SAT';

  // Multi-objective reward
  const rewardResult = calcMultiObjectiveReward({
    dailyReturn: (closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6] / 5,
    cvar: riskReport.cvar95 / 100,
    drawdown: (riskReport.maxDrawdown || 0) / 100,
    turnover: 0.002,
    regime: regimeKeyMap[regime.currentRegime],
  });

  // ─── KADEME 6: ÇOK ZAMAN DİLİMLİ TAHMİN ─────────────────────────────────
  const predictionData = longTermData.priceData.length > priceData.length ? longTermData.priceData : priceData;
  const predictions = generateFullPredictions(predictionData);

  // ─── KADEME 6.5: AĞIRLIKLI ETKİ ANALİZİ ──────────────────────────────────
  const indicators = {
    rsi: rsiInterp,
    macd: macdInterp,
    sma: smaInterp,
    bollinger: bollingerInterp,
    volume: volumeInterp,
  };
  const macroForImpact = { cds: macro.cds, vix: macro.vix, macroScore: macroScoreVal };
  const regimeForImpact = { name: regime.regimeName };
  const impactAnalysis = calculateImpactAnalysis(indicators, macroForImpact, regimeForImpact, riskReport, fundScore);

  // ═══ v5.2: Fiyat Etki Analizi (TL + %) ═══
  const priceImpact = calculatePriceImpact({
    currentPrice,
    var95: riskReport.var95,
    annualSigma: riskReport.garch?.annualSigma,
    kaldirac: stockRatios?.leverage,
    nfbFavok: stockRatios?.nfbToEbitda,
    cds: macro.cds,
    vix: macro.vix,
    indicators: {
      rsi: { raw: rsi14Raw, ...rsiInterp },
      macd: { raw: macdRaw, ...macdInterp },
      sma: { raw: { sma20: sma20Raw, sma50: sma50Raw }, ...smaInterp },
      bollinger: { raw: bollingerRaw, ...bollingerInterp },
      volume: volumeInterp,
    },
    predictions,
    fundamentalScore: fundScore,
    fk: stockRatios?.fk,
  });

  // Commentary
  const commentary = generateAICommentary({
    rsi: rsiInterp, macd: macdInterp, sma: smaInterp, bollinger: bollingerInterp,
    volume: volumeInterp, trend: trendInterp, macroData: macro, finalScore, signal,
    regime, ofi: ofiResult, riskReport, fracDiff: fracDiffResult, priceImpact, currentPrice,
    stochastic: stochasticRaw, adx: adxRaw, mfi: mfiRaw, fibonacci: fibonacciRaw, supportResistance: supportResistanceRaw
  });

  // ─── TAHMİN GEÇMİŞİ ─────────────────────────────────────────────────────
  // Tahminleri kaydet (arka planda)
  savePrediction(ticker, currentPrice, predictions, signal, finalScore).catch(() => {});
  // Geçmiş karşılaştırma
  const predictionHistory = await getPredictionHistory(ticker).catch(() => ({
    history: [], metrics: { totalPredictions: 0 }
  }));

  // ─── Pipeline bilgisi ────────────────────────────────────────────────────
  const result = {
    ticker,
    currentPrice,
    signal,
    finalScore,
    indicators: {
      rsi: { raw: rsi14Raw, ...rsiInterp },
      macd: { raw: { macd: macdRaw?.macd, signal: macdRaw?.signal, hist: macdRaw?.hist }, ...macdInterp },
      sma: { raw: { sma20: sma20Raw, sma50: sma50Raw }, ...smaInterp },
      ema: { ema12: ema12Raw, ema26: ema26Raw },
      bollinger: { raw: bollingerRaw, ...bollingerInterp },
      stochastic: stochasticRaw,
      adx: adxRaw,
      mfi: mfiRaw,
      fibonacci: fibonacciRaw,
      supportResistance: supportResistanceRaw,
      volume: { ...volumeInterp },
      trend: { ...trendInterp },
      ofi: ofiResult,
    },
    macro: { cds: macro.cds, vix: macro.vix, macroScore: macroScoreVal },
    regime: {
      name: regime.regimeName,
      probabilities: regime.probabilities,
      dynamicWeights: { tech: wTech, fund: wFund, macro: wMacro, sent: wSent },
      expectedDuration: regime.expectedDuration,
      crisisRisk: regime.crisisRisk,
      alert: regime.alert,
      volatility: regime.recentVolatility,
    },
    risk: {
      var95: riskReport.var95,
      var99: riskReport.var99,
      cvar95: riskReport.cvar95,
      xi: riskReport.xi,
      tailRisk: riskReport.tailRisk,
      garch: riskReport.garch,
      maxDrawdown: riskReport.maxDrawdown,
      riskScore,
    },
    fracDiff: {
      d: fracDiffResult.d,
      memoryRetained: fracDiffResult.memoryRetained,
    },
    gPolicy: { bestAction: gPolicy.bestAction, bestProb: gPolicy.bestProb },
    reward: rewardResult.reward,
    commentary,
    priceData: priceData.slice(-60),
    // ═══ YENİ v5.0 ALANLARI ═══
    predictions,
    impactAnalysis,
    predictionHistory,
    // ═══ v5.1: 5 Kademeli Risk Seviyesi ═══
    riskLevel: calculateRiskLevel({
      cariOran: stockRatios?.currentRatio,
      asitTest: stockRatios?.acidTest,
      nakitDonusum: null,
      kaldirac: stockRatios?.leverage,
      nfbFavok: stockRatios?.nfbToEbitda,
      faizKoruma: null,
      var95: riskReport.var95,
      annualSigma: riskReport.garch?.annualSigma,
      beta: null,
      maxDrawdown: riskReport.maxDrawdown,
      indicators: { rsi: rsiInterp, macd: macdInterp, trend: trendInterp, bollinger: bollingerInterp },
      cds: macro.cds,
      vix: macro.vix,
    }),
    // ═══ v5.2: Fiyat Etki Analizi (TL + %) ═══
    priceImpact: priceImpact,
    analysisTimestamp: new Date().toISOString(),
  };

  // Pipeline adımları (result üzerinden üretiliyor)
  result.pipeline = generatePipelineSteps(result);

  return result;
}

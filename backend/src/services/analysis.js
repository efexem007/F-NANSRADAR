import { fetchStockPrices } from './yahooFinance.js';
import { calculateRSI, calculateMACD, calculateSMA, calculateBollinger } from './technical.js';
import { getMacroData } from './macroData.js';

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
 * Genel AI yorumu üret
 */
function generateAICommentary(data) {
  const { rsi, macd: macdInterp, sma, bollinger, volume, trend, macroData, finalScore, signal } = data;
  
  const lines = [];
  
  // Genel karar
  if (signal.includes('GÜÇLÜ AL') || signal.includes('GUCLU AL')) {
    lines.push(`📈 **Güçlü Alım Sinyali:** Bu hisse, birden fazla teknik göstergede eş zamanlı olumlu sinyal veriyor.`);
  } else if (signal.includes('AL')) {
    lines.push(`✅ **Alım Sinyali:** Teknik görünüm genel olarak olumlu.`);
  } else if (signal.includes('GÜÇLÜ SAT') || signal.includes('GUCLU SAT')) {
    lines.push(`📉 **Güçlü Satış Sinyali:** Birden fazla göstergede risk uyarısı.`);
  } else if (signal.includes('SAT')) {
    lines.push(`⚠️ **Satış Sinyali:** Teknik görünüm olumsuz.`);
  } else {
    lines.push(`⏸ **Bekle:** Hisse karışık sinyaller veriyor, net bir yön beklenmeli.`);
  }

  // Öne çıkan faktörler
  const positives = [];
  const negatives = [];

  if (rsi.score >= 65) positives.push('RSI alım bölgesinde');
  if (rsi.score <= 35) negatives.push('RSI satış bölgesinde');
  if (macdInterp.score >= 65) positives.push('MACD yükseliş momentumu var');
  if (macdInterp.score <= 35) negatives.push('MACD düşüş trendiyle uyumlu');
  if (sma.score >= 65) positives.push('Golden Cross formasyonu saptandı');
  if (sma.score <= 35) negatives.push('Death Cross baskısı devam ediyor');
  if (bollinger.score >= 70) positives.push('Bollinger alt bölgesinde - teknik destek');
  if (bollinger.score <= 30) negatives.push('Bollinger üst bölgesi aşıldı');
  if (volume.score >= 65) positives.push('Artan hacim trend teyidi sağlıyor');
  if (macroData.cds < 250) positives.push('Türkiye CDS riskleri düşük seviyede');
  if (macroData.cds > 350) negatives.push('Yüksek CDS - makro risk yüksek');
  if (macroData.vix < 20) positives.push('VIX düşük - piyasa sakin');
  if (macroData.vix > 30) negatives.push('VIX yüksek - küresel belirsizlik var');

  if (positives.length > 0) lines.push(`\n**Olumlu Faktörler:** ${positives.join(' • ')}`);
  if (negatives.length > 0) lines.push(`**Risk Faktörleri:** ${negatives.join(' • ')}`);

  lines.push(`\n_Algoritma skoru: **${finalScore}/100** (Teknik %35 + Temel %25 + Makro %20 + Hacim/Risk %20)_`);

  return lines.join('\n');
}

/**
 * Ana analiz fonksiyonu
 */
export async function analyzeStock(ticker, period = '3mo') {
  const { priceData, currentPrice } = await fetchStockPrices(ticker, period);
  if (!priceData || priceData.length < 14) {
    throw new Error(`${ticker} için yeterli fiyat verisi bulunamadı.`);
  }

  const rsi14Raw = calculateRSI(priceData);
  const macdRaw = calculateMACD(priceData);
  const sma20Raw = calculateSMA(priceData, 20);
  const sma50Raw = calculateSMA(priceData, 50);
  const bollingerRaw = calculateBollinger(priceData);

  const macro = await getMacroData();

  const rsiInterp = interpretRSI(rsi14Raw);
  const macdInterp = interpretMACD(macdRaw);
  const smaInterp = interpretSMA(sma20Raw, sma50Raw, currentPrice);
  const bollingerInterp = interpretBollinger(bollingerRaw, currentPrice);
  const volumeInterp = interpretVolume(priceData);
  const trendInterp = interpretTrend(priceData);

  // Ağırlıklı skor
  const techRaw = (rsiInterp.score * 0.35) + (macdInterp.score * 0.25) + (smaInterp.score * 0.2) + (bollingerInterp.score * 0.2);
  let macroScoreVal = 50;
  if (macro.cds < 200) macroScoreVal = 75;
  else if (macro.cds < 300) macroScoreVal = 60;
  else if (macro.cds > 400) macroScoreVal = 30;
  if (macro.vix < 20) macroScoreVal = Math.min(100, macroScoreVal + 15);
  else if (macro.vix > 30) macroScoreVal = Math.max(0, macroScoreVal - 15);

  const finalScore = Math.round((techRaw * 0.70) + (macroScoreVal * 0.20) + (volumeInterp.score * 0.10));

  let signal = 'BEKLE';
  if (finalScore >= 70) signal = 'GÜÇLÜ AL';
  else if (finalScore >= 55) signal = 'AL';
  else if (finalScore >= 40) signal = 'BEKLE';
  else if (finalScore >= 25) signal = 'SAT';
  else signal = 'GÜÇLÜ SAT';

  const commentary = generateAICommentary({
    rsi: rsiInterp, macd: macdInterp, sma: smaInterp, bollinger: bollingerInterp,
    volume: volumeInterp, trend: trendInterp, macroData: macro, finalScore, signal
  });

  return {
    ticker,
    currentPrice,
    signal,
    finalScore,
    indicators: {
      rsi: { raw: rsi14Raw, ...rsiInterp },
      macd: { raw: { macd: macdRaw?.macd, signal: macdRaw?.signal, hist: macdRaw?.hist, trend: macdRaw?.trend }, ...macdInterp },
      sma: { raw: { sma20: sma20Raw, sma50: sma50Raw }, ...smaInterp },
      bollinger: { raw: bollingerRaw, ...bollingerInterp },
      volume: { ...volumeInterp },
      trend: { ...trendInterp },
    },
    macro: { cds: macro.cds, vix: macro.vix, macroScore: macroScoreVal },
    commentary,
    priceData: priceData.slice(-60),
  };
}

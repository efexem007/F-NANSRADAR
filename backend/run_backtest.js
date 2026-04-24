import { PrismaClient } from '@prisma/client';
import { fetchStockPrices } from './src/services/yahooFinance.js';
import { calculateRSI, calculateMACD, calculateSMA, calculateBollinger } from './src/services/technical.js';
import { getMacroData } from './src/services/macroData.js';
import { findOptimalD, calcOFI } from './src/services/fracDiff.js';
import { detectRegime } from './src/services/regimeDetector.js';
import { calcRiskReport } from './src/services/riskAnalytics.js';

const prisma = new PrismaClient();

// This script backtests the accuracy of the current AI model on a given list of stocks
// By cutting off the most recent N days of data, simulating what the system would have predicted N days ago,
// and then comparing the "signal" or "prediction" to the actual price N days later.

async function runBacktest(tickers, backtestDays = 30) {
  console.log(`\n=============================================================`);
  console.log(`🔍 FİNANSRADAR BACKTEST & SİMÜLASYON SİSTEMİ BAŞLATILIYOR...`);
  console.log(`📊 Hedef Süre: ${backtestDays} gün öncesine dönüp tahmin yapma`);
  console.log(`🤖 Kapsam: ${tickers.length} Hisse`);
  console.log(`=============================================================\n`);

  let totalCorrect = 0;
  let totalAnalyzed = 0;

  const results = [];

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    console.log(`[${i+1}/${tickers.length}] 🔄 Backtest: ${ticker}`);

    try {
      // 1. Fetch full historical data
      const { priceData } = await fetchStockPrices(ticker, '1y', '1d');

      if (!priceData || priceData.length < backtestDays + 30) {
        console.log(`      ❌ Yeterli veri yok (gerekli: ${backtestDays + 30}, mevcut: ${priceData.length})`);
        continue;
      }

      // 2. Split data: past (for simulation) vs future (for verification)
      const pastData = priceData.slice(0, priceData.length - backtestDays);
      const futureData = priceData.slice(priceData.length - backtestDays);

      const simulationDate = pastData[pastData.length - 1].date;
      const simulationPrice = pastData[pastData.length - 1].close;
      const actualFuturePrice = futureData[futureData.length - 1].close;

      // 3. Run a simplified version of the analysis logic on pastData
      const rsiRaw = calculateRSI(pastData);
      const macdRaw = calculateMACD(pastData);
      const sma20 = calculateSMA(pastData, 20);
      const sma50 = calculateSMA(pastData, 50);

      // Simplified scoring based on existing logic (reduced version)
      let score = 50;
      if (rsiRaw !== null) {
          if (rsiRaw < 30) score += 15;
          if (rsiRaw > 70) score -= 15;
      }
      if (macdRaw && macdRaw.hist > 0) score += 10;
      else if (macdRaw) score -= 10;

      if (sma20 && sma50) {
          if (sma20 > sma50) score += 10;
          else score -= 10;
      }

      // Normalize score
      score = Math.max(0, Math.min(100, score));

      // Signal interpretation
      let simulatedSignal = 'BEKLE';
      if (score >= 65) simulatedSignal = 'AL';
      if (score >= 75) simulatedSignal = 'GÜÇLÜ AL';
      if (score <= 35) simulatedSignal = 'SAT';
      if (score <= 25) simulatedSignal = 'GÜÇLÜ SAT';

      // 4. Verify Accuracy
      const priceDiffPct = ((actualFuturePrice - simulationPrice) / simulationPrice) * 100;
      let isCorrect = false;

      if ((simulatedSignal.includes('AL') && priceDiffPct > 2) ||
          (simulatedSignal.includes('SAT') && priceDiffPct < -2) ||
          (simulatedSignal === 'BEKLE' && Math.abs(priceDiffPct) <= 5)) {
          isCorrect = true;
          totalCorrect++;
      }

      totalAnalyzed++;

      results.push({
          ticker,
          simulationPrice,
          actualFuturePrice,
          priceDiffPct: priceDiffPct.toFixed(2),
          simulatedSignal,
          isCorrect
      });

      const resColor = isCorrect ? '\x1b[32mBAŞARILI\x1b[0m' : '\x1b[31mBAŞARISIZ\x1b[0m';
      console.log(`      ✅ Simülasyon: ₺${simulationPrice.toFixed(2)} -> Gerçek: ₺${actualFuturePrice.toFixed(2)} (%${priceDiffPct.toFixed(2)})`);
      console.log(`      🤖 Sinyal: ${simulatedSignal} | Sonuç: ${resColor}`);

    } catch (e) {
      console.log(`      ❌ Hata: ${e.message}`);
    }

    // API limitleri
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n=============================================================`);
  console.log(`🏁 BACKTEST TAMAMLANDI!`);
  const accuracy = totalAnalyzed > 0 ? (totalCorrect / totalAnalyzed) * 100 : 0;
  console.log(`📈 Toplam Analiz: ${totalAnalyzed} | Doğru Tahmin: ${totalCorrect} | Başarı Oranı: %${accuracy.toFixed(2)}`);
  console.log(`=============================================================\n`);

  await prisma.$disconnect();
}

// Seçili BIST hisselerinde test et
const testStocks = ['THYAO.IS', 'GARAN.IS', 'ASELS.IS', 'SASA.IS', 'HEKTS.IS', 'KOZAL.IS', 'TUPRS.IS', 'BIMAS.IS', 'ISCTR.IS', 'KCHOL.IS'];
runBacktest(testStocks, 30); // 30 gün öncesi

import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import { fetchStockPrices } from './yahooFinance.js';
import { calculateRSI, calculateMACD, calculateSMA, calculateBollinger } from './technical.js';
import { calculateRatios } from './calculator.js';
import { fundamentalScore, technicalScore, macroScore, calculateFinalSignal } from './signal.js';

export const initScheduler = () => {
  console.log('Zamanlayici baslatildi');
  cron.schedule('0 18 * * *', async () => {
    console.log('Gunluk guncelleme basliyor');
    await updateAllStocks();
  });
  return { runNow: updateAllStocks };
};

const updateAllStocks = async () => {
  const stocks = await prisma.stock.findMany();

  const [cds, vix] = await Promise.all([
    prisma.macroIndicator.findFirst({ where: { type: 'CDS' }, orderBy: { date: 'desc' } }),
    prisma.macroIndicator.findFirst({ where: { type: 'VIX' }, orderBy: { date: 'desc' } })
  ]);

  for (const stock of stocks) {
    try {
      const priceData = await fetchStockPrices(stock.ticker, '3mo', '1d');
      for (const point of priceData.priceData) {
        await prisma.pricePoint.upsert({
          where: { stockTicker_date: { stockTicker: stock.ticker, date: point.date } },
          update: point,
          create: { ...point, stockTicker: stock.ticker }
        });
      }
      await prisma.stock.update({ where: { ticker: stock.ticker }, data: { lastPrice: priceData.currentPrice, lastUpdate: new Date() } });
      const dbPrices = await prisma.pricePoint.findMany({ where: { stockTicker: stock.ticker }, orderBy: { date: 'asc' }, take: 50 });
      if (dbPrices.length >= 14) {
        const rsi14 = calculateRSI(dbPrices);
        const macd = calculateMACD(dbPrices);
        const sma20 = calculateSMA(dbPrices, 20);
        const sma50 = calculateSMA(dbPrices, 50);
        const bollinger = calculateBollinger(dbPrices);
        await prisma.technicalIndicator.create({ data: { ticker: stock.ticker, date: new Date(), rsi14, macd: macd?.macd, macdSignal: macd?.signal, macdHist: macd?.hist, sma20, sma50, bollingerUpper: bollinger?.upper, bollingerLower: bollinger?.lower } });
      }
      const fundamental = await prisma.fundamentalData.findFirst({ where: { stockTicker: stock.ticker }, orderBy: { period: 'desc' } });
      if (fundamental) {
        const ratios = calculateRatios(fundamental, priceData.currentPrice, fundamental.sharesOutstanding);
        await prisma.stockRatio.upsert({ where: { stockTicker: stock.ticker }, update: { ...ratios, calculatedAt: new Date() }, create: { ...ratios, stockTicker: stock.ticker } });
        const techLatest = await prisma.technicalIndicator.findFirst({ where: { ticker: stock.ticker }, orderBy: { date: 'desc' } });
        const fundScore = fundamentalScore(ratios);
        const techScoreVal = techLatest ? technicalScore({ rsi14: techLatest.rsi14, macdHist: techLatest.macdHist, sma20: techLatest.sma20, sma50: techLatest.sma50, bollingerLower: techLatest.bollingerLower, currentPrice: priceData.currentPrice }) : 50;
        const macroScoreVal = (cds && vix) ? macroScore(cds.value, vix.value) : 50;
        const { signal, score } = calculateFinalSignal(fundScore, techScoreVal, macroScoreVal);
        await prisma.signalHistory.create({ data: { ticker: stock.ticker, signal, score, price: priceData.currentPrice || 0 } });
      }
      console.log(`${stock.ticker} guncellendi`);
    } catch (err) { console.error(`${stock.ticker} hatasi:`, err.message); }
  }
};

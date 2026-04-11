import { PrismaClient } from '@prisma/client';
import { fetchStockPrices } from './yahooFinance.js';
import { calculateRSI, calculateMACD, calculateSMA, calculateBollinger } from './technical.js';
import { calculateRatios } from './calculator.js';
import { fundamentalScore, technicalScore, macroScore } from './signal.js';
import { getMacroData } from './macroData.js';

const prisma = new PrismaClient();

export async function scanSingleStock(ticker) {
  try {
    const priceData = await fetchStockPrices(ticker, '3mo', '1d');
    if (!priceData.priceData.length) throw new Error('Fiyat verisi yok');

    // Hissenin veritabanında var olduğundan emin ol
    await prisma.stock.upsert({
      where: { ticker },
      update: {},
      create: {
        ticker,
        name: ticker,
        sector: 'Unknown',
        lastPrice: priceData.currentPrice
      }
    });

    for (const point of priceData.priceData) {
      await prisma.pricePoint.upsert({
        where: { stockTicker_date: { stockTicker: ticker, date: point.date } },
        update: point,
        create: { ...point, stockTicker: ticker }
      });
    }

    const prices = await prisma.pricePoint.findMany({
      where: { stockTicker: ticker },
      orderBy: { date: 'asc' },
      take: 50
    });
    
    let technical = {};
    if (prices.length >= 14) {
      const rsi14 = calculateRSI(prices);
      const macd = calculateMACD(prices);
      const sma20 = calculateSMA(prices, 20);
      const sma50 = calculateSMA(prices, 50);
      const bollinger = calculateBollinger(prices);
      technical = { rsi14, macd, sma20, sma50, bollinger };
      
      const today = new Date();
      today.setHours(0,0,0,0);
      
      await prisma.technicalIndicator.upsert({
        where: { ticker_date: { ticker: ticker, date: today } },
        update: {
          rsi14, macd: macd?.macd, macdSignal: macd?.signal, macdHist: macd?.hist,
          sma20, sma50, bollingerUpper: bollinger?.upper, bollingerLower: bollinger?.lower
        },
        create: {
          ticker, date: today,
          rsi14, macd: macd?.macd, macdSignal: macd?.signal, macdHist: macd?.hist,
          sma20, sma50, bollingerUpper: bollinger?.upper, bollingerLower: bollinger?.lower
        }
      });
    }

    const fundamental = await prisma.fundamentalData.findFirst({
      where: { stockTicker: ticker },
      orderBy: { period: 'desc' }
    });
    
    let ratios = null;
    if (fundamental) {
      ratios = calculateRatios(fundamental, priceData.currentPrice, fundamental.sharesOutstanding);
      await prisma.stockRatio.upsert({
        where: { stockTicker: ticker },
        update: { ...ratios, calculatedAt: new Date() },
        create: { ...ratios, stockTicker: ticker }
      });
    }

    const macro = await getMacroData();
    let haberSkoru = 0.5;

    const fundScore = ratios ? fundamentalScore(ratios) : 50;
    const techScore = technical.rsi14 ? technicalScore({
      rsi14: technical.rsi14, macdHist: technical.macd?.hist,
      sma20: technical.sma20, sma50: technical.sma50,
      bollingerLower: technical.bollinger?.lower, currentPrice: priceData.currentPrice
    }) : 50;
    const macroScoreVal = macroScore(macro.cds, macro.vix);
    const haberPuan = haberSkoru * 100;

    let riskScore = 50;
    if (prices.length > 20) {
      const returns = prices.slice(-20).map((p, i, arr) => i === 0 ? 0 : (p.close - arr[i-1].close) / arr[i-1].close);
      const volatility = returns.reduce((a,b) => a + b*b, 0) / Math.sqrt(20);
      riskScore = Math.max(0, 100 - volatility * 100);
    }

    const finalScore = (techScore * 0.35) + (fundScore * 0.25) + (macroScoreVal * 0.20) + (haberPuan * 0.10) + (riskScore * 0.10);

    let finalSignal = 'BEKLE';
    if (finalScore >= 70) finalSignal = 'GÜÇLÜ AL';
    else if (finalScore >= 55) finalSignal = 'AL';
    else if (finalScore >= 40) finalSignal = 'BEKLE';
    else if (finalScore >= 25) finalSignal = 'SAT';
    else finalSignal = 'GÜÇLÜ SAT';

    const detailsObj = { 
      techScore: Math.round(techScore), 
      fundScore: Math.round(fundScore), 
      macroScoreVal: Math.round(macroScoreVal), 
      haberPuan: Math.round(haberPuan), 
      riskScore: Math.round(riskScore) 
    };

    await prisma.signalHistory.create({
      data: { 
        ticker, 
        signal: finalSignal, 
        score: Math.round(finalScore), 
        price: priceData.currentPrice || 0,
        details: JSON.stringify(detailsObj)
      }
    });

    await prisma.stock.update({
      where: { ticker },
      data: { lastPrice: priceData.currentPrice, lastUpdate: new Date() }
    });

    return { 
      ticker, 
      signal: finalSignal, 
      score: Math.round(finalScore), 
      price: priceData.currentPrice,
      details: detailsObj
    };
  } catch (error) {
    console.error(`Scan hatası ${ticker}:`, error.message);
    return { ticker, error: error.message };
  }
}

export async function scanAllStocks(tickerList = null) {
  let stocks;
  if (tickerList && tickerList.length) stocks = await prisma.stock.findMany({ where: { ticker: { in: tickerList } } });
  else stocks = await prisma.stock.findMany();
  
  const results = [];
  for (const stock of stocks) {
    const result = await scanSingleStock(stock.ticker);
    results.push(result);
    // 1 saniye bekle
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return results;
}

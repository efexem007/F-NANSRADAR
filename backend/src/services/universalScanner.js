/**
 * FinansRadar — Universal Multi-Asset Scanner v6.0
 * ================================================
 * BIST Hisse + Forex + Emtia + Kripto + Endeks + ETF
 * Her varlık: Teknik analiz → Fırsat skoru → AI sinyali
 */

import { fetchStockPrices } from './yahooFinance.js';
import { calculateRSI, calculateMACD, calculateSMA, calculateBollinger } from './technical.js';
import { getMacroData } from './macroData.js';
import prisma from '../lib/prisma.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const bistMaster = require('../data/bistMaster.json');

// ═══════════════════════════════════════════════════════════════════════════
// ASSET UNIVERSES
// ═══════════════════════════════════════════════════════════════════════════

export const ASSET_UNIVERSES = {
  bist: {
    label: 'BIST Hisseler',
    icon: '🏛️',
    // Bu liste DB'den alınacak, burada fallback
    symbols: [],
    suffix: '',
  },
  forex: {
    label: 'Döviz & Pariteler',
    icon: '💱',
    symbols: [
      { symbol: 'USDTRY=X', name: 'USD/TRY', flag: '🇺🇸🇹🇷' },
      { symbol: 'EURTRY=X', name: 'EUR/TRY', flag: '🇪🇺🇹🇷' },
      { symbol: 'GBPTRY=X', name: 'GBP/TRY', flag: '🇬🇧🇹🇷' },
      { symbol: 'EURUSD=X', name: 'EUR/USD', flag: '🇪🇺🇺🇸' },
      { symbol: 'GBPUSD=X', name: 'GBP/USD', flag: '🇬🇧🇺🇸' },
      { symbol: 'USDJPY=X', name: 'USD/JPY', flag: '🇺🇸🇯🇵' },
    ],
    suffix: '',
  },
  crypto: {
    label: 'Kripto Para',
    icon: '₿',
    symbols: [
      { symbol: 'BTC-USD', name: 'Bitcoin', flag: '🪙' },
      { symbol: 'ETH-USD', name: 'Ethereum', flag: '⟠' },
      { symbol: 'SOL-USD', name: 'Solana', flag: '◎' },
      { symbol: 'AVAX-USD', name: 'Avalanche', flag: '🔺' },
      { symbol: 'BNB-USD', name: 'BNB', flag: '💛' },
      { symbol: 'XRP-USD', name: 'XRP', flag: '💧' },
    ],
    suffix: '',
  },
  commodity: {
    label: 'Emtialar',
    icon: '🛢️',
    symbols: [
      { symbol: 'GC=F', name: 'Altın', flag: '🥇' },
      { symbol: 'SI=F', name: 'Gümüş', flag: '🥈' },
      { symbol: 'CL=F', name: 'Ham Petrol (WTI)', flag: '🛢️' },
      { symbol: 'NG=F', name: 'Doğalgaz', flag: '🔥' },
      { symbol: 'ZW=F', name: 'Buğday', flag: '🌾' },
      { symbol: 'ZC=F', name: 'Mısır', flag: '🌽' },
    ],
    suffix: '',
  },
  index: {
    label: 'Endeksler',
    icon: '📊',
    symbols: [
      { symbol: 'XU100.IS', name: 'BIST 100', flag: '🇹🇷' },
      { symbol: 'XU030.IS', name: 'BIST 30', flag: '🇹🇷' },
      { symbol: '^GSPC', name: 'S&P 500', flag: '🇺🇸' },
      { symbol: '^IXIC', name: 'NASDAQ', flag: '🇺🇸' },
      { symbol: '^DJI', name: 'Dow Jones', flag: '🇺🇸' },
      { symbol: '^GDAXI', name: 'DAX', flag: '🇩🇪' },
      { symbol: '^FTSE', name: 'FTSE 100', flag: '🇬🇧' },
    ],
    suffix: '',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE ASSET ANALYZER (Universal)
// ═══════════════════════════════════════════════════════════════════════════

// timeFrame → Yahoo Finance period/interval mapping
const TIME_FRAME_MAP = {
  '1H':  { period: '5d',  interval: '1h',  days: 5 },
  '4H':  { period: '1mo', interval: '1h',  days: 30 },
  '1D':  { period: '3mo', interval: '1d',  days: 90 },
  '1W':  { period: '6mo', interval: '1d',  days: 180 },
  '1M':  { period: '1y',  interval: '1d',  days: 365 },
  '3M':  { period: '1y',  interval: '1d',  days: 365 },
  '6M':  { period: '2y',  interval: '1d',  days: 730 },
  '1Y':  { period: '2y',  interval: '1d',  days: 730 },
};

export async function analyzeAsset(symbol, name, assetType, filters = {}) {
  const { timeFrame = '1D' } = filters;
  const tfConfig = TIME_FRAME_MAP[timeFrame] || TIME_FRAME_MAP['1D'];

  // Yahoo Finance'den veri çek (suffix yok, sembol kendi içinde IS vs suffix taşıyor)
  const isISStock = symbol.endsWith('.IS') || assetType === 'bist';
  
  let priceData, currentPrice;
  try {
    if (assetType === 'bist' && !symbol.endsWith('.IS')) {
      // BIST hisseler: mevcut fetchStockPrices
      const result = await fetchStockPrices(symbol, tfConfig.period, tfConfig.interval);
      priceData = result.priceData;
      currentPrice = result.currentPrice;
    } else {
      // Forex, crypto, commodity, index — yahoo-finance2 historical
      const YahooModule = await import('yahoo-finance2');
      const YahooFinance = YahooModule.default || YahooModule;
      const yahoo = typeof YahooFinance === 'function' ? new YahooFinance({ suppressNotices: ['yahooSurvey'] }) : YahooFinance;
      
      // historical API daha güvenilir
      const period1 = new Date(Date.now() - tfConfig.days * 24 * 60 * 60 * 1000);
      const interval = tfConfig.interval === '1h' ? '1h' : '1d';
      let quotes;
      try {
        quotes = await yahoo.historical(symbol, { period1, interval });
      } catch (e1) {
        // Fallback: chart API
        try {
          const chartResult = await yahoo.chart(symbol, { period1, interval });
          quotes = chartResult?.quotes?.filter(q => q.close != null).map(q => ({
            date: new Date(q.date),
            open: q.open,
            high: q.high,
            low: q.low,
            close: q.close,
            volume: q.volume || 0,
            adjClose: q.close,
          }));
        } catch (e2) {
          throw new Error(`Veri çekilemedi: ${e1.message}`);
        }
      }

      if (!quotes?.length) throw new Error('Veri yok');
      
      priceData = quotes
        .filter(q => q.close != null && !isNaN(q.close))
        .map(q => ({
          date: new Date(q.date),
          open: q.open || q.close,
          high: q.high || q.close,
          low: q.low || q.close,
          close: q.close,
          volume: q.volume || 0,
        }));
      currentPrice = priceData[priceData.length - 1]?.close;
    }
  } catch (e) {
    throw new Error(`${symbol}: ${e.message}`);
  }

  if (!priceData || priceData.length < 14) {
    throw new Error(`${symbol}: Yetersiz veri`);
  }

  // Teknik İndikatörler
  const rsi = calculateRSI(priceData);
  const macd = calculateMACD(priceData);
  const sma20 = calculateSMA(priceData, 20);
  const sma50 = calculateSMA(priceData, 50);
  const bollinger = calculateBollinger(priceData);

  // Değişim hesapla
  const closes = priceData.map(p => p.close);
  const change1d = closes.length >= 2 ? ((closes[closes.length-1] / closes[closes.length-2]) - 1) * 100 : 0;
  const change7d = closes.length >= 7 ? ((closes[closes.length-1] / closes[closes.length-7]) - 1) * 100 : 0;
  const change30d = closes.length >= 30 ? ((closes[closes.length-1] / closes[closes.length-30]) - 1) * 100 : 0;

  // Volatilite (20 gün)
  let volatility = 0;
  if (closes.length >= 20) {
    const rets = [];
    for (let i = closes.length - 20; i < closes.length; i++) {
      rets.push(Math.log(closes[i] / closes[i - 1]));
    }
    const mean = rets.reduce((a,b) => a+b, 0) / rets.length;
    const variance = rets.reduce((a,b) => a + (b-mean)**2, 0) / rets.length;
    volatility = Math.sqrt(variance * 252) * 100;
  }

  // Hacim ortalaması
  const avgVolume = priceData.slice(-20).reduce((a, p) => a + p.volume, 0) / 20;
  const lastVolume = priceData[priceData.length - 1]?.volume || 0;
  const relativeVolume = avgVolume > 0 ? (lastVolume / avgVolume) : 1;

  // Teknik Skor (0-100)
  let techScore = 50;
  if (rsi != null) {
    if (rsi < 30) techScore += 15;
    else if (rsi < 45) techScore += 5;
    else if (rsi > 70) techScore -= 12;
    else if (rsi > 60) techScore -= 3;
  }
  if (macd) {
    if (macd.hist > 0 && macd.macd > macd.signal) techScore += 12;
    else if (macd.hist > 0) techScore += 5;
    else if (macd.hist < 0 && macd.macd < macd.signal) techScore -= 10;
    else techScore -= 3;
  }
  if (sma20 && sma50) {
    if (sma20 > sma50 && currentPrice > sma20) techScore += 10;
    else if (sma20 > sma50) techScore += 5;
    else if (sma20 < sma50 && currentPrice < sma20) techScore -= 10;
    else techScore -= 3;
  }
  if (bollinger) {
    const pos = (currentPrice - bollinger.lower) / (bollinger.upper - bollinger.lower);
    if (pos < 0.15) techScore += 8; // Aşırı satım
    else if (pos > 0.85) techScore -= 6; // Aşırı alım
  }
  if (relativeVolume > 1.5) techScore += 5;
  techScore = Math.max(0, Math.min(100, techScore));

  // Risk Skoru (düşük risk = yüksek skor)
  let riskScore = 70;
  if (volatility > 60) riskScore -= 30;
  else if (volatility > 40) riskScore -= 15;
  else if (volatility > 25) riskScore -= 5;
  else riskScore += 10;
  riskScore = Math.max(0, Math.min(100, riskScore));

  // Momentum Skoru
  let momentumScore = 50;
  if (change7d > 5) momentumScore += 20;
  else if (change7d > 2) momentumScore += 10;
  else if (change7d < -5) momentumScore -= 15;
  else if (change7d < -2) momentumScore -= 8;
  if (change1d > 2) momentumScore += 10;
  else if (change1d < -2) momentumScore -= 10;
  momentumScore = Math.max(0, Math.min(100, momentumScore));

  // Fırsat Skoru (ağırlıklı)
  const opportunityScore = Math.round(
    techScore * 0.40 +
    riskScore * 0.25 +
    momentumScore * 0.35
  );

  // Sinyal
  let signal, signalColor;
  if (opportunityScore >= 75) { signal = 'GÜÇLÜ AL'; signalColor = 'emerald'; }
  else if (opportunityScore >= 60) { signal = 'AL'; signalColor = 'green'; }
  else if (opportunityScore >= 45) { signal = 'BEKLE'; signalColor = 'amber'; }
  else if (opportunityScore >= 30) { signal = 'SAT'; signalColor = 'orange'; }
  else { signal = 'GÜÇLÜ SAT'; signalColor = 'red'; }

  // Yıllık getiri tahmini (30 günlük performanstan yıllıklaştır)
  const estimatedAnnualReturn = closes.length >= 30
    ? parseFloat((((closes[closes.length-1] / closes[closes.length-30]) ** (365/30)) - 1) * 100).toFixed(1)
    : closes.length >= 7
      ? parseFloat((((closes[closes.length-1] / closes[closes.length-7]) ** (365/7)) - 1) * 100).toFixed(1)
      : null;

  // Risk seviyesi etiketi
  let riskLevel = 'Orta';
  if (volatility > 50) riskLevel = 'Çok Yüksek';
  else if (volatility > 35) riskLevel = 'Yüksek';
  else if (volatility > 20) riskLevel = 'Orta';
  else riskLevel = 'Düşük';

  return {
    symbol,
    name: name || symbol,
    type: assetType,
    currentPrice: parseFloat(currentPrice?.toFixed(4) || 0),
    change1d: parseFloat(change1d.toFixed(2)),
    change7d: parseFloat(change7d.toFixed(2)),
    change30d: parseFloat(change30d.toFixed(2)),
    volume: lastVolume,
    relativeVolume: parseFloat(relativeVolume.toFixed(2)),
    volatility: parseFloat(volatility.toFixed(1)),
    estimatedAnnualReturn: estimatedAnnualReturn ? parseFloat(estimatedAnnualReturn) : null,
    riskLevel,
    techScore,
    riskScore,
    momentumScore,
    opportunityScore,
    signal,
    signalColor,
    indicators: {
      rsi: rsi != null ? parseFloat(rsi.toFixed(1)) : null,
      macd: macd ? { macd: parseFloat(macd.macd?.toFixed(3) || 0), signal: parseFloat(macd.signal?.toFixed(3) || 0), hist: parseFloat(macd.hist?.toFixed(3) || 0) } : null,
      sma20: sma20 ? parseFloat(sma20.toFixed(2)) : null,
      sma50: sma50 ? parseFloat(sma50.toFixed(2)) : null,
      goldenCross: sma20 && sma50 ? sma20 > sma50 : null,
    },
    lastUpdate: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SCAN ENTIRE MARKET
// ═══════════════════════════════════════════════════════════════════════════

export async function scanMarket(marketType = 'all', filters = {}) {
  const results = [];
  const errors = [];
  const marketsToScan = marketType === 'all'
    ? Object.keys(ASSET_UNIVERSES)
    : [marketType];

  for (const market of marketsToScan) {
    const universe = ASSET_UNIVERSES[market];
    if (!universe) continue;

    let symbols = universe.symbols;

    // BIST hisseler: bistMaster.json'dan al (DB yerine)
    if (market === 'bist') {
      symbols = (bistMaster.allBist || []).map(ticker => ({ 
        symbol: ticker + '.IS', 
        name: ticker, 
        flag: '🇹🇷' 
      }));
    }

    for (const item of symbols) {
      try {
        const sym = typeof item === 'string' ? item : item.symbol;
        const name = typeof item === 'string' ? item : item.name;
        const result = await analyzeAsset(sym, name, market, filters);
        result.flag = typeof item === 'object' ? item.flag : '🇹🇷';
        results.push(result);
      } catch (e) {
        errors.push({ symbol: typeof item === 'string' ? item : item.symbol, error: e.message });
      }
      // Rate limit
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Sırala: Fırsat skoru
  results.sort((a, b) => b.opportunityScore - a.opportunityScore);

  return {
    totalScanned: results.length + errors.length,
    totalPassed: results.length,
    totalErrors: errors.length,
    results,
    errors,
    scanTime: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AI PICKS — Günün En İyi Fırsatları
// ═══════════════════════════════════════════════════════════════════════════

export function generateAIPicks(scanResults) {
  const items = scanResults.results || [];
  
  const picks = {
    topOverall: items.slice(0, 5),
    topBist: items.filter(i => i.type === 'bist').slice(0, 5),
    topCrypto: items.filter(i => i.type === 'crypto').slice(0, 3),
    topForex: items.filter(i => i.type === 'forex').slice(0, 3),
    topCommodity: items.filter(i => i.type === 'commodity').slice(0, 3),
    oversold: items.filter(i => i.indicators?.rsi != null && i.indicators.rsi < 30).slice(0, 5),
    momentum: items.filter(i => i.change7d > 5 && i.relativeVolume > 1.3).slice(0, 5),
    lowRisk: items.filter(i => i.riskScore > 75).sort((a,b) => b.riskScore - a.riskScore).slice(0, 5),
  };

  return picks;
}

// ═══════════════════════════════════════════════════════════════════════════
// WATCHLIST MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

export async function addToWatchlist(userId, { symbol, name, assetType, targetPrice, stopLoss, notes, tags }) {
  return prisma.watchlistItem.upsert({
    where: { userId_symbol: { userId, symbol } },
    update: { name, assetType, targetPrice, stopLoss, notes, tags: tags ? JSON.stringify(tags) : null, updatedAt: new Date() },
    create: { userId, symbol, name, assetType, addedPrice: 0, targetPrice, stopLoss, notes, tags: tags ? JSON.stringify(tags) : null },
  });
}

export async function removeFromWatchlist(userId, symbol) {
  return prisma.watchlistItem.delete({ where: { userId_symbol: { userId, symbol } } }).catch(() => null);
}

export async function getWatchlist(userId) {
  const items = await prisma.watchlistItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  
  // Her item için canlı veri
  const enriched = [];
  for (const item of items) {
    try {
      const analysis = await analyzeAsset(item.symbol, item.name, item.assetType);
      enriched.push({
        ...item,
        tags: item.tags ? JSON.parse(item.tags) : [],
        live: {
          currentPrice: analysis.currentPrice,
          change1d: analysis.change1d,
          change7d: analysis.change7d,
          signal: analysis.signal,
          opportunityScore: analysis.opportunityScore,
          rsi: analysis.indicators?.rsi,
        },
        pnlPct: item.addedPrice > 0 ? parseFloat(((analysis.currentPrice - item.addedPrice) / item.addedPrice * 100).toFixed(2)) : null,
        distanceToTarget: item.targetPrice ? parseFloat(((item.targetPrice - analysis.currentPrice) / analysis.currentPrice * 100).toFixed(2)) : null,
        distanceToStop: item.stopLoss ? parseFloat(((analysis.currentPrice - item.stopLoss) / analysis.currentPrice * 100).toFixed(2)) : null,
      });
    } catch (e) {
      enriched.push({ ...item, tags: item.tags ? JSON.parse(item.tags) : [], live: null, error: e.message });
    }
  }

  return enriched;
}

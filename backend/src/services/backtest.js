import prisma from '../lib/prisma.js';
import { fetchStockPrices } from './yahooFinance.js';
import { calculateRSI, calculateMACD, calculateSMA, calculateBollinger } from './technical.js';

export const runBacktest = async (ticker, startDate, endDate) => {
  // Önce Yahoo Finance'den gerçek fiyat verisi al
  const diffMs = endDate - startDate;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  let period = '3mo';
  if (diffDays > 365) period = '1y';
  else if (diffDays > 180) period = '6mo';
  else if (diffDays > 90) period = '3mo';
  else period = '1mo';

  const { priceData } = await fetchStockPrices(ticker, period);
  if (!priceData || priceData.length < 30) {
    return { error: 'Yeterli fiyat verisi yok. Lütfen önce AI Scanner ile bu hisseyi tarayın.' };
  }

  // Tarih filtreleme
  const filtered = priceData.filter(p => {
    const d = new Date(p.date);
    return d >= startDate && d <= endDate;
  });
  const data = filtered.length >= 20 ? filtered : priceData;

  // Teknik göstergelerle AL/SAT sinyali üret
  const trades = [];
  let balance = 10000, position = 0, peak = 10000, maxDrawdown = 0;
  
  for (let i = 26; i < data.length; i++) {
    const slice = data.slice(0, i + 1);
    const rsi = calculateRSI(slice);
    const macd = calculateMACD(slice);
    const sma20 = calculateSMA(slice, 20);
    const sma50 = calculateSMA(slice, 50);
    const bollinger = calculateBollinger(slice);
    const price = data[i].close;

    const bullish = rsi < 40 && macd?.hist > 0 && sma20 > sma50;
    const bearish = rsi > 65 || (macd?.hist < 0 && price > bollinger?.upper);

    if (bullish && position === 0 && balance > 0) {
      position = balance / price;
      balance = 0;
      trades.push({ date: data[i].date, action: 'BUY', price });
    } else if (bearish && position > 0) {
      balance = position * price;
      position = 0;
      trades.push({ date: data[i].date, action: 'SELL', price });
      if (balance > peak) peak = balance;
      const drawdown = (peak - balance) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
  }

  if (position > 0) balance = position * data[data.length - 1].close;
  
  const totalReturn = ((balance - 10000) / 10000) * 100;
  const sellTrades = trades.filter(t => t.action === 'SELL');
  let wins = 0;
  for (let i = 0; i < sellTrades.length; i++) {
    const sell = sellTrades[i];
    const buyBefore = trades.filter(t => t.action === 'BUY' && new Date(t.date) < new Date(sell.date)).pop();
    if (buyBefore && sell.price > buyBefore.price) wins++;
  }
  const winRate = sellTrades.length ? (wins / sellTrades.length) * 100 : 0;

  return {
    ticker,
    initialCapital: 10000,
    finalCapital: Math.round(balance * 100) / 100,
    totalReturnPercent: Math.round(totalReturn * 100) / 100,
    winRate: Math.round(winRate * 10) / 10,
    maxDrawdownPercent: Math.round(maxDrawdown * 10000) / 100,
    tradeCount: sellTrades.length,
    trades: trades.slice(0, 20)
  };
};


import prisma from '../lib/prisma.js';

export const runBacktest = async (ticker, startDate, endDate) => {
  const signals = await prisma.signalHistory.findMany({
    where: { ticker, createdAt: { gte: startDate, lte: endDate } },
    orderBy: { createdAt: 'asc' }
  });
  if (signals.length < 2) return { error: 'Yeterli sinyal yok' };
  let balance = 10000, position = 0, trades = [], peak = balance, maxDrawdown = 0;
  for (let i = 0; i < signals.length - 1; i++) {
    const sig = signals[i];
    const nextPrice = signals[i+1].price;
    if (sig.signal.includes('AL') && position === 0) {
      position = balance / nextPrice;
      balance = 0;
      trades.push({ date: sig.createdAt, action: 'BUY', price: nextPrice });
    } else if (sig.signal.includes('SAT') && position > 0) {
      balance = position * nextPrice;
      position = 0;
      trades.push({ date: sig.createdAt, action: 'SELL', price: nextPrice });
      if (balance > peak) peak = balance;
      const drawdown = (peak - balance) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
  }
  if (position > 0) balance = position * signals[signals.length-1].price;
  const totalReturn = ((balance - 10000) / 10000) * 100;
  const sellTrades = trades.filter(t => t.action === 'SELL');
  const winRate = sellTrades.length ? (sellTrades.filter(t => t.price > (trades.find(tt => tt.date < t.date && tt.action === 'BUY')?.price || 0)).length / sellTrades.length) * 100 : 0;
  return { ticker, initialCapital: 10000, finalCapital: balance, totalReturnPercent: totalReturn, winRate, maxDrawdownPercent: maxDrawdown * 100, tradeCount: sellTrades.length };
};

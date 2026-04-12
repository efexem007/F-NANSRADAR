import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();
export const fetchStockPrices = async (ticker, period = '3mo', interval = '1d') => {
  try {
    const query = `${ticker}.IS`;
    const period1 = new Date();
    switch(period) {
      case '1mo': period1.setMonth(period1.getMonth() - 1); break;
      case '3mo': period1.setMonth(period1.getMonth() - 3); break;
      case '6mo': period1.setMonth(period1.getMonth() - 6); break;
      case '1y': period1.setFullYear(period1.getFullYear() - 1); break;
      case '2y': period1.setFullYear(period1.getFullYear() - 2); break;
      case '5y': period1.setFullYear(period1.getFullYear() - 5); break;
      default: period1.setMonth(period1.getMonth() - 3);
    }
    const period2 = new Date(); // now
    const opts = { period1: period1.toISOString(), period2: period2.toISOString(), interval };
    const chartData = await yahooFinance.chart(query, opts);
    
    if (!chartData || !chartData.quotes) return { priceData: [], currentPrice: null };
    
    const priceData = chartData.quotes
      .filter(item => item.close !== null)
      .map(item => ({ date: item.date, open: item.open, high: item.high, low: item.low, close: item.close, volume: item.volume }));
    const currentPrice = priceData[priceData.length - 1]?.close || null;
    return { priceData, currentPrice };
  } catch (error) {
    console.error(`Yahoo Finance hatasi (${ticker}):`, error.message);
    return { priceData: [], currentPrice: null };
  }
};

export const fetchCurrentPrice = async (ticker) => {
  try { const quote = await yahooFinance.quote(`${ticker}.IS`); return quote.regularMarketPrice; }
  catch (error) { return null; }
};


import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

/**
 * Mevcut fiyatı hızlıca çekmek için (Geriye dönük uyumluluk için eklendi)
 */
export const fetchCurrentPrice = async (ticker) => {
  try {
    const { currentPrice } = await fetchStockPrices(ticker, '1mo', '1d');
    return currentPrice;
  } catch (e) {
    return null;
  }
};

/**
 * Temel verileri çekmek için (Geriye dönük uyumluluk için eklendi)
 */
export const fetchFundamentals = async (ticker) => {
  return await fetchStockFundamentals(ticker);
};

export const fetchStockPrices = async (ticker, period = '3mo', interval = '1d') => {
  try {
    let query = ticker.toUpperCase();
    if (!query.includes('.') && !query.includes('-')) query = `${query}.IS`;
    
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
    const chartData = await yahooFinance.chart(query, { period1: period1.toISOString(), interval });
    
    if (!chartData || !chartData.quotes) return { priceData: [], currentPrice: null };
    
    const priceData = chartData.quotes
      .filter(item => item.close !== null)
      .map(item => ({ date: item.date, open: item.open, high: item.high, low: item.low, close: item.close, volume: item.volume }));
    const currentPrice = priceData[priceData.length - 1]?.close || null;
    return { priceData, currentPrice };
  } catch (error) {
    console.warn(`[Yahoo Price] ${ticker} hatası:`, error.message);
    return { priceData: [], currentPrice: null };
  }
};

export const fetchStockFundamentals = async (ticker) => {
  try {
    let query = ticker.toUpperCase();
    if (!query.includes('.') && !query.includes('-')) query = `${query}.IS`;

    const summary = await yahooFinance.quoteSummary(query, { 
      modules: ['assetProfile', 'financialData', 'defaultKeyStatistics', 'incomeStatementHistory', 'balanceSheetHistory'] 
    }).catch(() => null);

    if (!summary) return null;

    const profile = summary.assetProfile || {};
    const fd = summary.financialData || {};
    const stats = summary.defaultKeyStatistics || {};
    const income = summary.incomeStatementHistory?.incomeStatementHistory?.[0] || {};
    const balance = summary.balanceSheetHistory?.balanceSheetHistory?.[0] || {};

    return {
      profile: {
        sector: profile.sector || 'Diğer',
        industry: profile.industry || 'Genel',
        description: profile.longBusinessSummary,
        name: summary.price?.longName || ticker
      },
      ratios: {
        currentRatio: fd.currentRatio || (balance.totalCurrentAssets / balance.totalCurrentLiabilities) || null,
        fk: fd.trailingPE || stats.forwardPE || null,
        pddd: stats.priceToBook || (fd.marketCap / fd.totalEquity) || null,
        netMargin: fd.profitMargins ? fd.profitMargins * 100 : (income.netIncome / fd.totalRevenue * 100),
        leverage: fd.debtToEquity ? fd.debtToEquity / 100 : (fd.totalDebt / fd.totalEquity),
        nfbToEbitda: fd.ebitda > 0 ? ((fd.totalDebt - fd.totalCash) / fd.ebitda) : null,
        grossMargin: fd.grossMargins ? fd.grossMargins * 100 : (income.grossProfit / fd.totalRevenue * 100),
        acidTest: fd.quickRatio || ((balance.totalCurrentAssets - balance.inventory) / balance.totalCurrentLiabilities) || null
      },
      fundamental: {
        period: balance.endDate ? new Date(balance.endDate).getFullYear().toString() : new Date().getFullYear().toString(),
        totalAssets: fd.totalAssets || balance.totalAssets,
        equity: fd.totalEquity || balance.totalStockholderEquity,
        currentAssets: balance.totalCurrentAssets || fd.totalCash,
        currentLiabilities: balance.totalCurrentLiabilities,
        netSales: fd.totalRevenue || income.totalRevenue,
        ebitda: fd.ebitda,
        netProfit: fd.netIncomeToCommon || income.netIncome
      }
    };
  } catch (error) {
    console.error(`Bilanço hatası (${ticker}):`, error.message);
    return null;
  }
};

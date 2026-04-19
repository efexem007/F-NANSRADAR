
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/**
 * Mevcut fiyatı hızlıca çekmek için (Geriye dönük uyumluluk)
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
 * Temel verileri çekmek için (Geriye dönük uyumluluk)
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

/**
 * Temel finansal verileri çek - financialData + defaultKeyStatistics + price kullanır
 * Not: fundamentalsTimeSeries BIST için çalışmıyor (Kasım 2024'ten beri)
 * financialData TTM (Trailing Twelve Months) canlı verisi sağlıyor.
 */
export const fetchStockFundamentals = async (ticker) => {
  try {
    let query = ticker.toUpperCase();
    if (!query.includes('.') && !query.includes('-')) query = `${query}.IS`;

    const summary = await yahooFinance.quoteSummary(query, { 
      modules: [
        'assetProfile', 
        'financialData', 
        'defaultKeyStatistics',
        'summaryDetail',
        'price',
        'calendarEvents',
        'earningsTrend',
      ] 
    }).catch(() => null);

    if (!summary) return null;

    const profile = summary.assetProfile || {};
    const fd = summary.financialData || {};
    const stats = summary.defaultKeyStatistics || {};
    const detail = summary.summaryDetail || {};
    const priceInfo = summary.price || {};

    // --- Gelir Tablosu (TTM - Son 12 Ay) ---
    // financialData içinde doğrudan değer olarak geliyor (raw özelliğinde değil!)
    const revenue = fd.totalRevenue || null;
    const grossProfit = fd.grossProfits || null;
    const ebitda = fd.ebitda || null;
    const operatingCashFlow = fd.operatingCashflow || null;
    const freeCashFlow = fd.freeCashflow || null;
    const netIncomeToCommon = stats.netIncomeToCommon || stats.netIncomeAllocatedToCommonShareholders || null;

    // --- Borç & Likidite ---
    const totalDebt = fd.totalDebt || null;
    const totalCash = fd.totalCash || null;
    const currentRatio = fd.currentRatio || null;
    const quickRatio = fd.quickRatio || null;

    // --- Hisse Başına ---
    const revenuePerShare = fd.revenuePerShare || null;
    const eps = stats.trailingEps || null;
    const bookValue = stats.bookValue || null;
    const shareOutstanding = stats.sharesOutstanding || priceInfo.sharesOutstanding || null;

    // --- Piyasa Verileri ---
    const marketCap = priceInfo.marketCap || detail.marketCap || null;
    const enterpriseValue = stats.enterpriseValue || null;

    // --- Büyüme ---
    const earningsGrowth = fd.earningsGrowth ? fd.earningsGrowth * 100 : null;
    const revenueGrowth = fd.revenueGrowth ? fd.revenueGrowth * 100 : null;

    // --- Oran Hesaplamaları ---
    const grossMargin = fd.grossMargins ? fd.grossMargins * 100 : 
                        (grossProfit && revenue ? (grossProfit / revenue) * 100 : null);
    const ebitdaMargin = fd.ebitdaMargins ? fd.ebitdaMargins * 100 : 
                         (ebitda && revenue ? (ebitda / revenue) * 100 : null);
    const netMargin = fd.profitMargins ? fd.profitMargins * 100 :
                      (netIncomeToCommon && revenue ? (netIncomeToCommon / revenue) * 100 : null);
    const operatingMargin = fd.operatingMargins ? fd.operatingMargins * 100 : null;
    
    // Çarpanlar
    const fk = fd.trailingPE || stats.forwardPE || null;
    const pddd = stats.priceToBook || null;
    const evToEbitda = stats.enterpriseToEbitda || null;
    const evToRevenue = stats.enterpriseToRevenue || null;
    
    // Kaldıraç
    const leverage = fd.debtToEquity ? fd.debtToEquity / 100 : null;
    
    // NFB/FAVÖK
    let nfbToFavok = null;
    if (ebitda && totalDebt && totalCash) {
      nfbToFavok = (totalDebt - totalCash) / ebitda;
    }
    
    // ROE / ROA
    const roe = fd.returnOnEquity ? fd.returnOnEquity * 100 : null;
    const roa = fd.returnOnAssets ? fd.returnOnAssets * 100 : null;

    // Toplam Özkaynak (Piyasa değerinden türet eğer direkt yoksa)
    let totalEquity = null;
    if (bookValue && shareOutstanding) {
      totalEquity = bookValue * shareOutstanding;
    }

    return {
      profile: {
        sector: profile.sector || 'Diğer',
        industry: profile.industry || 'Genel',
        description: profile.longBusinessSummary,
        name: priceInfo.longName || priceInfo.shortName || ticker,
        employees: profile.fullTimeEmployees || null,
        website: profile.website || null,
        country: profile.country || 'Türkiye',
        currency: priceInfo.currency || 'TRY',
        exchange: priceInfo.exchangeName || 'BIST',
      },
      ratios: {
        // Değerleme
        fk,
        pddd,
        evToEbitda,
        evToRevenue,
        beta: stats.beta || priceInfo.beta || null,
        // Karlılık
        grossMargin,
        ebitdaMargin,
        netMargin,
        operatingMargin,
        roe,
        roa,
        // Likidite
        currentRatio,
        quickRatio,
        // Borçluluk  
        leverage,
        nfbToEbitda: nfbToFavok,
        // Büyüme
        earningsGrowth,
        revenueGrowth,
        // Diğer
        dividendYield: detail.dividendYield ? detail.dividendYield * 100 : null,
        payoutRatio: detail.payoutRatio ? detail.payoutRatio * 100 : null,
        eps,
        bookValue,
        revenuePerShare,
        marketCap,
      },
      fundamental: {
        period: 'TTM (Son 12 Ay)',
        // Gelir Tablosu
        netSales: revenue,
        grossProfit,
        ebitda,
        netProfit: netIncomeToCommon,
        operatingCashFlow,
        freeCashFlow,
        // Bilanço (kısmi)
        totalDebt,
        cash: totalCash,
        equity: totalEquity,
        // Piyasa
        marketCap,
        enterpriseValue,
        shareOutstanding,
        eps,
        bookValue,
      }
    };
  } catch (error) {
    console.error(`Bilanço hatası (${ticker}):`, error.message);
    return null;
  }
};

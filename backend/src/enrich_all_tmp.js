
import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';

const prisma = new PrismaClient();
const yahooFinance = new YahooFinance();

async function enrichAllStocks() {
  console.log('--- Kapsamlı Veri Tamamlama Operasyonu Başlatıldı ---');
  
  const stocks = await prisma.stock.findMany({
    where: { isActive: true },
    select: { ticker: true, type: true }
  });

  console.log(`Toplam ${stocks.length} hisse temel verileri için taranacak.`);

  for (const stock of stocks) {
    let ticker = stock.ticker;
    if (stock.type === 'bist' && !ticker.includes('.')) ticker = `${ticker}.IS`;

    try {
      console.log(`🔍 İşleniyor: ${ticker}`);
      const summary = await yahooFinance.quoteSummary(ticker, {
        modules: ['financialData', 'defaultKeyStatistics', 'incomeStatementHistory', 'balanceSheetHistory']
      });

      const fd = summary.financialData || {};
      const stats = summary.defaultKeyStatistics || {};
      const income = summary.incomeStatementHistory?.incomeStatementHistory?.[0] || {};
      
      // 1. Rasyoları Güncelle
      await prisma.stockRatio.upsert({
        where: { stockTicker: stock.ticker },
        update: {
          currentRatio: fd.currentRatio || null,
          leverage: fd.debtToEquity ? fd.debtToEquity / 100 : null,
          netMargin: fd.profitMargins ? fd.profitMargins * 100 : null,
          fk: stats.forwardPE || null,
          pddd: stats.priceToBook || null,
          nfbToEbitda: (fd.totalDebt && fd.ebitda) ? fd.totalDebt / fd.ebitda : null,
          calculatedAt: new Date()
        },
        create: {
          stockTicker: stock.ticker,
          currentRatio: fd.currentRatio || null,
          leverage: fd.debtToEquity ? fd.debtToEquity / 100 : null,
          netMargin: fd.profitMargins ? fd.profitMargins * 100 : null,
          fk: stats.forwardPE || null,
          pddd: stats.priceToBook || null,
          nfbToEbitda: (fd.totalDebt && fd.ebitda) ? fd.totalDebt / fd.ebitda : null,
        }
      });

      // 2. Bilanço (FundamentalData) Güncelle - Son Dönem
      if (fd.totalRevenue || income.netIncome) {
        await prisma.fundamentalData.upsert({
          where: { 
            stockTicker_period: { 
              stockTicker: stock.ticker, 
              period: stats.mostRecentQuarter ? new Date(stats.mostRecentQuarter).getFullYear().toString() + '/Q4' : '2025/Q4' 
            } 
          },
          update: {
            totalAssets: stats.enterpriseValue || 0, // Fallback placeholder if missing
            equity: stats.bookValue * stats.sharesOutstanding || 0,
            netSales: fd.totalRevenue || 0,
            netProfit: income.netIncome || 0,
            ebitda: fd.ebitda || 0,
            currentAssets: (fd.currentRatio && fd.totalDebt) ? fd.currentRatio * fd.totalDebt : 0, // Estimation
            currentLiabilities: fd.totalDebt || 0,
          },
          create: {
            stockTicker: stock.ticker,
            period: stats.mostRecentQuarter ? new Date(stats.mostRecentQuarter).getFullYear().toString() + '/Q4' : '2025/Q4',
            totalAssets: stats.enterpriseValue || 0,
            equity: stats.bookValue * stats.sharesOutstanding || 0,
            netSales: fd.totalRevenue || 0,
            netProfit: income.netIncome || 0,
            ebitda: fd.ebitda || 0,
            currentAssets: (fd.currentRatio && fd.totalDebt) ? fd.currentRatio * fd.totalDebt : 0,
            currentLiabilities: fd.totalDebt || 0,
          }
        });
      }

      console.log(`✅ ${stock.ticker} tamamlandı.`);
    } catch (e) {
      console.error(`❌ ${ticker} hatası:`, e.message);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('--- Operasyon Başarıyla Tamamlandı ---');
  process.exit(0);
}

enrichAllStocks();


import prisma from '../lib/prisma.js';
import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

/**
 * Makro Göstergeleri Güncelle (Görev 81-89)
 */
export async function syncMacroData() {
  const indicators = [
    { type: 'VIX', symbol: '^VIX' },
    { type: 'USDTRY', symbol: 'USDTRY=X' },
    { type: 'BIST100', symbol: 'XU100.IS' },
    { type: 'SP500', symbol: '^GSPC' },
    { type: 'GOLD', symbol: 'GC=F' }
  ];

  const results = [];

  for (const ind of indicators) {
    try {
      const quote = await yahooFinance.quote(ind.symbol);
      const value = quote.regularMarketPrice;
      
      if (value) {
        const record = await prisma.macroIndicator.create({
          data: { type: ind.type, value, date: new Date() }
        });
        results.push(record);
      }
    } catch (e) {
      console.error(`Makro sync hatası (${ind.type}):`, e.message);
    }
  }

  // Manuel veya Özel API verileri (Örn: Faiz, CDS)
  // Şimdilik pasif, ileride TCMB/Investing scraper eklenebilir.
  
  return results;
}

export async function getMacroData() {
  const types = ['VIX', 'USDTRY', 'BIST100', 'CDS', 'INTEREST', 'SP500'];
  const latestData = {};

  for (const type of types) {
    const record = await prisma.macroIndicator.findFirst({
      where: { type },
      orderBy: { date: 'desc' }
    });
    latestData[type.toLowerCase()] = record ? record.value : null;
  }

  // Fallback defaults
  if (!latestData.cds) latestData.cds = 265;
  if (!latestData.interest) latestData.interest = 50.0;
  
  return latestData;
}


import { PrismaClient } from '@prisma/client';
import YahooFinance from 'yahoo-finance2';

const prisma = new PrismaClient();
const yahooFinance = new YahooFinance();

async function updateAllPrices() {
  console.log('--- Toplu Fiyat Güncelleme Başlatıldı (v2) ---');
  
  const stocks = await prisma.stock.findMany({
    where: { isActive: true }
  });

  console.log(`Toplam ${stocks.length} hisse taranacak.`);

  for (const stock of stocks) {
    let ticker = stock.ticker;
    // BIST hissesi ise ve .IS yoksa ekle
    if (stock.type === 'bist' && !ticker.includes('.')) {
      ticker = `${ticker}.IS`;
    }

    try {
      const quote = await yahooFinance.quote(ticker);
      const currentPrice = quote.regularMarketPrice;
      
      if (currentPrice) {
        await prisma.stock.update({
          where: { ticker: stock.ticker },
          data: { 
            lastPrice: currentPrice,
            lastUpdate: new Date()
          }
        });
        console.log(`✅ ${stock.ticker} (${ticker}): ${currentPrice}`);
      } else {
         console.warn(`⚠️ ${ticker}: Fiyat bulunamadı.`);
      }
    } catch (e) {
      console.error(`❌ ${ticker} hatası:`, e.message);
    }
    // Rate limit koruması
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('--- Güncelleme Tamamlandı ---');
  process.exit(0);
}

updateAllPrices();


import prisma from './lib/prisma.js';
import { fetchStockFundamentals } from './services/yahooFinance.js';

async function enrichAllStocks() {
  console.log('🚀 Toplu veri zenginleştirme (V3 - Rasyolar) başlıyor...');

  // En az veri olan 100 hisseyi seç
  const stocks = await prisma.stock.findMany({
    where: {
      OR: [
        { lastPrice: 0 },
        { sector: 'Unknown' },
        { ratios: { is: null } }
      ]
    },
    take: 50
  });

  console.log(`📡 Toplam ${stocks.length} hisse için derin analiz yapılacak.`);

  for (let i = 0; i < stocks.length; i++) {
    const s = stocks[i];
    console.log(`[${i+1}/${stocks.length}] İşleniyor: ${s.ticker}`);

    try {
      const data = await fetchStockFundamentals(s.ticker);
      if (data) {
        // 1. Profil Güncelleme
        await prisma.stock.update({
          where: { ticker: s.ticker },
          data: {
            name: data.profile.name || s.name,
            sector: data.profile.sector || 'Diğer',
            industry: data.profile.industry || 'Genel',
          }
        });

        // 2. Rasyoları Güncelleme
        if (data.ratios) {
          await prisma.stockRatio.upsert({
            where: { stockTicker: s.ticker },
            update: { ...data.ratios, calculatedAt: new Date() },
            create: { ...data.ratios, stockTicker: s.ticker, calculatedAt: new Date() }
          });
          console.log(`📊 ${s.ticker} rasyoları başarıyla kaydedildi.`);
        }

        // 3. Dönemlik Bilanço (Fundamental)
        if (data.fundamental) {
          await prisma.fundamentalData.upsert({
            where: { stockTicker_period: { stockTicker: s.ticker, period: data.fundamental.period } },
            update: data.fundamental,
            create: { ...data.fundamental, stockTicker: s.ticker }
          });
        }
        
        console.log(`✅ ${s.ticker} tamamlandı.`);
      } else {
        console.log(`⚠️ ${s.ticker} için veri çekilemedi.`);
      }
    } catch (e) {
      console.error(`❌ ${s.ticker} hatası:`, e.message);
    }

    // Anti-ban gecikmesi
    await new Promise(r => setTimeout(r, 600));
  }

  console.log('🏁 İşlem tamamlandı.');
}

enrichAllStocks().catch(console.error);

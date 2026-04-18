
import prisma from './lib/prisma.js';

async function cleanupDuplicates() {
  console.log('🔍 Mükerrer ticker kontrolü başlıyor...');

  const stocks = await prisma.stock.findMany({ select: { ticker: true } });
  
  const tickerGroups = {};
  stocks.forEach(s => {
    const base = s.ticker.split('.')[0];
    if (!tickerGroups[base]) tickerGroups[base] = [];
    tickerGroups[base].push(s);
  });

  for (const base in tickerGroups) {
    const group = tickerGroups[base];
    if (group.length > 1) {
      console.log(`⚠️ Mükerrer bulundu: ${base} (${group.map(g => g.ticker).join(', ')})`);
      
      const toKeep = group.find(g => g.ticker.endsWith('.IS')) || group[0];
      const toDelete = group.filter(g => g.ticker !== toKeep.ticker);

      for (const d of toDelete) {
        console.log(`🗑️ Siliniyor: ${d.ticker}`);
        try {
          await prisma.fundamentalData.deleteMany({ where: { stockTicker: d.ticker } });
          await prisma.stockRatio.deleteMany({ where: { stockTicker: d.ticker } });
          await prisma.pricePoint.deleteMany({ where: { stockTicker: d.ticker } });
          await prisma.stock.delete({ where: { ticker: d.ticker } });
        } catch (e) {
          console.error(`❌ ${d.ticker} silinemedi:`, e.message);
        }
      }
    }
  }

  console.log('🔍 Hatalı rasyo kayıtları temizleniyor...');
  const allRatios = await prisma.stockRatio.findMany();
  const ratioMap = {};
  for (const r of allRatios) {
    if (ratioMap[r.stockTicker]) {
      console.log(`🗑️ Mükerrer rasyo temizleniyor: ${r.stockTicker}`);
      await prisma.stockRatio.delete({ where: { stockTicker: r.stockTicker } });
    } else {
      ratioMap[r.stockTicker] = true;
    }
  }

  console.log('✅ Temizlik tamamlandı.');
}

cleanupDuplicates().catch(console.error);

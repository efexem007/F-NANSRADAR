import { PrismaClient } from '@prisma/client';
import { analyzeStock } from './src/services/analysis.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const bistMaster = require('./src/data/bistMaster.json');

const prisma = new PrismaClient();

async function runControlledScan() {
  console.log('\n=============================================================');
  console.log('🚀 FİNANSRADAR AI SİSTEMİ BAŞLATILIYOR...');
  console.log('📊 Kapsam: Borsa İstanbul (Tüm BIST 30 / BIST 100 Hisseleri)');
  console.log('🤖 İşlem: Tam Kapsamlı (Temel, Teknik, Makro) Yapay Zeka Analizi');
  console.log('=============================================================\n');

  // Tüm hisseleri master JSON'dan toplayalım
  const allTickers = bistMaster.allBist || [
    ...(bistMaster.bist30 || []),
    ...(bistMaster.bist100Additions || []),
  ];

  // Benzersiz olanları al
  const uniqueTickers = [...new Set(allTickers)];
  
  console.log(`[BİLGİ] Taranacak toplam hisse sayısı: ${uniqueTickers.length}`);
  
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < uniqueTickers.length; i++) {
    const symbol = uniqueTickers[i];
    const percentage = (((i + 1) / uniqueTickers.length) * 100).toFixed(1);
    
    console.log(`\n[${percentage}%] 🔄 Analiz ediliyor: ${symbol} (${i + 1}/${uniqueTickers.length})`);
    
    try {
      // AnalyzeStock fonksiyonu AI motorunu, 10 indikatörü ve Yahoo datasını tetikler
      const result = await analyzeStock(`${symbol}.IS`);
      
      const price = result.indicators?.currentPrice || 'N/A';
      const signal = result.signal || 'BEKLE';
      const score = result.finalScore || 'N/A';
      const rsi = result.indicators?.rsi?.raw ? result.indicators.rsi.raw.toFixed(1) : 'N/A';
      
      let signalColor = '\x1b[33m'; // BEKLE (Sarı)
      if (signal.includes('AL')) signalColor = '\x1b[32m'; // AL (Yeşil)
      if (signal.includes('SAT')) signalColor = '\x1b[31m'; // SAT (Kırmızı)
      
      console.log(`      ✅ Tamamlandı. Fiyat: ₺${price} | RSI: ${rsi}`);
      console.log(`      🤖 AI Sinyali: ${signalColor}${signal}\x1b[0m | Skor: ${score}/100`);
      
      successCount++;
    } catch (error) {
      console.log(`      ❌ Hata: ${symbol} analiz edilemedi -> ${error.message}`);
      failCount++;
    }
    
    // API limitlerine takılmamak için hisseler arası 1.5 saniye bekle
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n=============================================================');
  console.log('🏁 TARAMA TAMAMLANDI!');
  console.log(`📈 Başarılı: ${successCount} | ❌ Hatalı: ${failCount}`);
  console.log('=============================================================\n');

  await prisma.$disconnect();
}

runControlledScan();

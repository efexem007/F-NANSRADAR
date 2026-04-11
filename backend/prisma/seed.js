import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Veritabanı temizleniyor...');
  await prisma.portfolioItem.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.user.deleteMany();
  await prisma.technicalIndicator.deleteMany();
  await prisma.signalHistory.deleteMany();
  await prisma.pricePoint.deleteMany();
  await prisma.fundamentalData.deleteMany();
  await prisma.stockRatio.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.macroIndicator.deleteMany();

  console.log('🌱 Makro göstergeler ekleniyor...');
  await prisma.macroIndicator.createMany({
    data: [
      { type: 'CDS', value: 295.5, note: 'Türkiye 5 Yıllık CDS' },
      { type: 'VIX', value: 14.2, note: 'Korku Endeksi' },
      { type: 'FAIZ', value: 50.0, note: 'TCMB Politika Faizi' },
      { type: 'ENFLASYON', value: 64.7, note: 'TÜFE Yıllık' }
    ]
  });

  console.log('📈 Hisseler ekleniyor...');
  const stocks = [
    { ticker: 'THYAO', name: 'Türk Hava Yolları', sector: 'Ulaştırma' },
    { ticker: 'AKBNK', name: 'Akbank', sector: 'Bankacılık' },
    { ticker: 'TUPRS', name: 'Tüpraş', sector: 'Sanayi' },
    { ticker: 'ASELS', name: 'Aselsan', sector: 'Savunma' }
  ];

  for (const s of stocks) {
    await prisma.stock.create({
      data: {
        ticker: s.ticker,
        name: s.name,
        sector: s.sector,
        lastPrice: 250 + Math.random() * 50,
      }
    });

    console.log(`📊 ${s.ticker} Temel Verileri ekleniyor...`);
    await prisma.fundamentalData.create({
      data: {
        stockTicker: s.ticker,
        period: '2023-12',
        currentAssets: 50000000,
        currentLiabilities: 30000000,
        inventory: 5000000,
        totalAssets: 150000000,
        equity: 60000000,
        netSales: 80000000,
        grossProfit: 25000000,
        ebitda: 15000000,
        netProfit: 8000000,
        netFinancialDebt: 20000000,
        sharesOutstanding: 1380000000
      }
    });

    await prisma.stockRatio.create({
      data: {
        stockTicker: s.ticker,
        currentRatio: 1.66,
        acidTest: 1.50,
        grossMargin: 31.2,
        netMargin: 10.0,
        leverage: 2.5,
        nfbToEbitda: 1.33,
        fk: 5.5,
        pddd: 1.2
      }
    });

    // Generate 90 days of fake price history
    console.log(`📈 ${s.ticker} Fiyat Geçmişi ekleniyor...`);
    const prices = [];
    let currentPrice = 200 + Math.random() * 100;
    
    for (let i = 90; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const change = (Math.random() - 0.48) * 5; // Slight upward bias
      currentPrice = currentPrice + change;
      
      prices.push({
        stockTicker: s.ticker,
        date: date,
        open: currentPrice - 1,
        high: currentPrice + 2,
        low: currentPrice - 2,
        close: currentPrice,
        volume: 1000000 + Math.random() * 5000000
      });
    }
    
    await prisma.pricePoint.createMany({ data: prices });

    // Dummy signal history
    await prisma.signalHistory.create({
      data: {
        ticker: s.ticker,
        signal: Math.random() > 0.5 ? 'GUCLU AL' : 'AL',
        score: Math.floor(60 + Math.random() * 30),
        price: currentPrice
      }
    });
  }

  console.log('👤 Demo Kullanıcı ekleniyor...');
  const hashedPassword = await bcrypt.hash('123456', 10);
  const user = await prisma.user.create({
    data: {
      email: 'demo@finansradar.com',
      password: hashedPassword,
      name: 'Demo Kullanıcı'
    }
  });

  const portfolio = await prisma.portfolio.create({
    data: { name: 'Ana Portföy', userId: user.id }
  });

  await prisma.portfolioItem.createMany({
    data: [
      { portfolioId: portfolio.id, ticker: 'THYAO', shares: 100, avgCost: 240.50 },
      { portfolioId: portfolio.id, ticker: 'AKBNK', shares: 500, avgCost: 35.20 }
    ]
  });

  console.log('✅ Tohumlama (Seed) başarıyla tamamlandı!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

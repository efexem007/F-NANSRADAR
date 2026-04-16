import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const tickers = ['THYAO','AKBNK','TUPRS','ASELS','GARAN','ISCTR','KCHOL','SAHOL','EREGL','BIMAS','SISE','ENKAI','YKBNK','TCELL','FROTO','PGSUS','TOASO','ARCLK','KRDMD','PETKM','TTKOM', 'HEKTS', 'SASA', 'OTKAR', 'KOZAL'];

async function main() {
  for (const t of tickers) {
    try {
      await prisma.stock.upsert({
        where: { ticker: t },
        update: {},
        create: {
          ticker: t,
          name: t,
          type: 'bist',
          exchange: 'IS',
          currency: 'TRY',
          source: 'yahoo',
          marketCap: 0,
          sector: 'Unknown',
          industry: 'Unknown'
        }
      });
    } catch(e) {}
  }
  console.log('BIST Stocks seeded.');
}

main().catch(console.error).finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
import yahooFinance from 'yahoo-finance2';

const prisma = new PrismaClient();

export async function getMacroData() {
  let cds = 250, vix = 20;
  const cdsRecord = await prisma.macroIndicator.findFirst({ where: { type: 'CDS' }, orderBy: { date: 'desc' } });
  if (cdsRecord) cds = cdsRecord.value;
  const vixRecord = await prisma.macroIndicator.findFirst({ where: { type: 'VIX' }, orderBy: { date: 'desc' } });
  if (vixRecord) vix = vixRecord.value;
  
  try {
    const vixQuote = await yahooFinance.quote('^VIX');
    vix = vixQuote.regularMarketPrice;
  } catch(e) {}
  
  return { cds, vix };
}


import prisma from '../lib/prisma.js';

/**
 * Veri Kalite Denetçisi (Görev 80+)
 * Sistemdeki verilerin güncelliğini ve doluluğunu kontrol eder.
 */
export async function auditStockData(ticker) {
  const stock = await prisma.stock.findUnique({
    where: { ticker },
    include: {
      fundamental: { orderBy: { period: 'desc' }, take: 1 },
      ratios: true,
      pricePoints: { orderBy: { date: 'desc' }, take: 1 }
    }
  });

  if (!stock) return { status: 'not_found', score: 0 };

  let issues = [];
  let score = 100;

  // 1. Güncellik Kontrolü
  const now = new Date();
  const lastUpdate = stock.lastUpdate || new Date(0);
  const diffHours = (now - lastUpdate) / (1000 * 60 * 60);
  
  if (diffHours > 24) {
    score -= 10;
    issues.push('Fiyat verisi 24 saatten eski.');
  }
  if (diffHours > 72) {
    score -= 20;
    issues.push('Veriler güncelliğini yitirmiş (72 saat+).');
  }

  // 2. Fundamental Doluluk Kontrolü
  if (!stock.fundamental || stock.fundamental.length === 0) {
    score -= 40;
    issues.push('Bilanço verisi bulunamadı.');
  } else {
    const fund = stock.fundamental[0];
    if (!fund.netProfit && fund.netProfit !== 0) { score -= 10; issues.push('Net Kâr verisi eksik.'); }
    if (!fund.ebitda && fund.ebitda !== 0) { score -= 5; issues.push('FAVÖK verisi eksik.'); }
    if (!fund.totalAssets) { score -= 5; issues.push('Varlık verisi eksik.'); }
  }

  // 3. Rasyo Kontrolü
  if (!stock.ratios) {
    score -= 15;
    issues.push('Finansal rasyolar hesaplanmamış.');
  }

  return {
    ticker,
    healthScore: Math.max(0, score),
    status: score > 80 ? 'healthy' : score > 50 ? 'warning' : 'critical',
    lastUpdate: stock.lastUpdate,
    issues,
    isReliable: score > 70
  };
}

/**
 * Toplu Sağlık Taraması
 */
export async function auditAllData() {
  const stocks = await prisma.stock.findMany({ select: { ticker: true } });
  const results = [];
  for (const s of stocks) {
    const audit = await auditStockData(s.ticker);
    if (audit.status !== 'healthy') results.push(audit);
  }
  return {
    totalChecked: stocks.length,
    unhealthyCount: results.length,
    unhealthyList: results.sort((a,b) => a.healthScore - b.healthScore)
  };
}

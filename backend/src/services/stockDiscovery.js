/**
 * FinansRadar — Stock Discovery & Enrichment Service
 * ====================================================
 * Görev 17: Hisse bilgisi güncelleme (Yahoo'dan sektör, marketCap, açıklama çekme)
 * Görev 31-34: Otomatik keşif, DB kontrolü, Yahoo arama, otomatik ekleme
 * Görev 39: Hisse validasyonu
 */

import prisma from '../lib/prisma.js';
import { fetchStockPrices, fetchCurrentPrice } from './yahooFinance.js';
import { createRequire } from 'module';
import logger from '../lib/logger.js';

const require = createRequire(import.meta.url);
const bistMaster = require('../data/bistMaster.json');

// ═══════════════════════════════════════════════════════════════════════════
// HISSE DOĞRULAMA (Görev 39)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verilen ticker'ın geçerli olup olmadığını kontrol eder
 * 1. DB'de var mı?
 * 2. Yahoo Finance'de veri dönüyor mu?
 */
export async function validateTicker(ticker) {
  const normalizedTicker = ticker.toUpperCase();
  
  // 1. DB kontrolü
  const dbRecord = await prisma.stock.findUnique({ where: { ticker: normalizedTicker } });
  if (dbRecord) {
    return {
      valid: true,
      source: 'database',
      ticker: normalizedTicker,
      name: dbRecord.name,
      type: dbRecord.type,
      exchange: dbRecord.exchange,
      isActive: dbRecord.isActive,
    };
  }

  // 2. .IS suffix dene (BIST)
  const bistTicker = normalizedTicker.endsWith('.IS') ? normalizedTicker : `${normalizedTicker}.IS`;
  const dbBist = await prisma.stock.findUnique({ where: { ticker: bistTicker } });
  if (dbBist) {
    return {
      valid: true,
      source: 'database',
      ticker: bistTicker,
      name: dbBist.name,
      type: dbBist.type,
      exchange: dbBist.exchange,
      isActive: dbBist.isActive,
    };
  }

  // 3. Yahoo Finance'den doğrulama
  try {
    const { priceData, currentPrice } = await fetchStockPrices(normalizedTicker, '1mo');
    if (priceData && priceData.length > 5 && currentPrice) {
      return {
        valid: true,
        source: 'yahoo',
        ticker: normalizedTicker.includes('.') || normalizedTicker.includes('-') || normalizedTicker.includes('=') || normalizedTicker.includes('^')
          ? normalizedTicker
          : `${normalizedTicker}.IS`,
        name: normalizedTicker,
        currentPrice,
        dataPoints: priceData.length,
        needsRegistration: true,
      };
    }
  } catch (e) {
    // Yahoo'da bulunamadı
  }

  return { valid: false, ticker: normalizedTicker, error: 'Ticker bulunamadı veya geçersiz.' };
}

// ═══════════════════════════════════════════════════════════════════════════
// HİSSE BİLGİSİ GÜNCELLEME (Görev 17)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Yahoo Finance'den hisse detay bilgilerini çeker ve DB'yi günceller
 */
export async function enrichStockInfo(ticker) {
  try {
    const yahoo = (await import('yahoo-finance2')).default;
    
    // quoteSummary API ile detaylı bilgi çek
    let summary;
    try {
      summary = await yahoo.quoteSummary(ticker, {
        modules: ['price', 'summaryProfile', 'financialData', 'defaultKeyStatistics']
      });
    } catch (e) {
      // Fallback: sadece quote dene
      const quote = await yahoo.quote(ticker);
      summary = { price: quote };
    }

    const price = summary?.price || {};
    const profile = summary?.summaryProfile || {};
    const financial = summary?.financialData || {};
    const stats = summary?.defaultKeyStatistics || {};

    const updateData = {};
    
    if (price.shortName || price.longName) {
      updateData.name = price.longName || price.shortName;
    }
    if (profile.sector) updateData.sector = profile.sector;
    if (profile.industry) updateData.industry = profile.industry;
    if (profile.longBusinessSummary) {
      updateData.description = profile.longBusinessSummary.substring(0, 500);
    }
    if (price.marketCap) updateData.marketCap = price.marketCap;
    if (price.regularMarketPrice) {
      updateData.lastPrice = price.regularMarketPrice;
      updateData.lastUpdate = new Date();
    }
    if (price.currency) updateData.currency = price.currency;
    if (price.exchange) updateData.exchange = price.exchange;

    // DB güncelle
    if (Object.keys(updateData).length > 0) {
      await prisma.stock.update({
        where: { ticker },
        data: updateData
      });
      logger.info(`[Enrichment] ${ticker} bilgileri güncellendi`, updateData);
    }

    return { ticker, updated: true, fields: Object.keys(updateData) };
  } catch (error) {
    logger.warn(`[Enrichment] ${ticker} güncellenemedi: ${error.message}`);
    return { ticker, updated: false, error: error.message };
  }
}

/**
 * Toplu hisse bilgisi güncelleme (batch enrichment)
 * Rate limit ile sıralı çalışır
 */
export async function batchEnrichStocks(tickers, delayMs = 500) {
  const results = { updated: 0, failed: 0, errors: [] };

  for (const ticker of tickers) {
    try {
      const result = await enrichStockInfo(ticker);
      if (result.updated) results.updated++;
      else {
        results.failed++;
        results.errors.push({ ticker, error: result.error });
      }
    } catch (e) {
      results.failed++;
      results.errors.push({ ticker, error: e.message });
    }
    // Rate limit
    await new Promise(r => setTimeout(r, delayMs));
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// OTOMATİK KEŞİF SERVİSİ (Görev 31-34)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Otomatik hisse keşfi: DB'de yoksa Yahoo'dan kontrol edip ekler
 */
export async function discoverAndRegister(ticker) {
  const normalizedTicker = ticker.toUpperCase();
  
  // 1. Zaten DB'de mi?
  const existing = await prisma.stock.findUnique({ where: { ticker: normalizedTicker } });
  if (existing) {
    return { action: 'exists', ticker: normalizedTicker, stock: existing };
  }

  // 2. Tip tespiti
  let type = 'bist';
  let exchange = 'IS';
  let currency = 'TRY';

  if (normalizedTicker.includes('-USD')) {
    type = 'crypto'; exchange = 'CCC'; currency = 'USD';
  } else if (normalizedTicker.includes('=X')) {
    type = 'forex'; exchange = 'CCY'; currency = 'USD';
  } else if (normalizedTicker.includes('^')) {
    type = 'index'; exchange = 'INDEX'; currency = 'USD';
  } else if (normalizedTicker.includes('=F')) {
    type = 'commodity'; exchange = 'CME'; currency = 'USD';
  }

  // 3. Yahoo Finance'den doğrula
  try {
    const { priceData, currentPrice } = await fetchStockPrices(normalizedTicker, '1mo');
    
    if (!priceData || priceData.length < 5) {
      return { action: 'invalid', ticker: normalizedTicker, error: 'Yeterli fiyat verisi yok' };
    }

    // 4. Sektör bilgisi (bistMaster'dan)
    let sector = 'Unknown';
    const baseTicker = normalizedTicker.replace('.IS', '');
    for (const [sectorName, tickers] of Object.entries(bistMaster.sectorMapping || {})) {
      if (tickers.includes(baseTicker)) {
        sector = sectorName;
        break;
      }
    }

    // 5. DB'ye ekle
    const newStock = await prisma.stock.create({
      data: {
        ticker: normalizedTicker,
        name: `${baseTicker} (Otomatik Keşif)`,
        type,
        exchange,
        currency,
        source: 'yahoo',
        sector,
        industry: 'Unknown',
        description: 'Sistem tarafından otomatik keşfedildi.',
        isActive: true,
        lastPrice: currentPrice,
        lastUpdate: new Date(),
      }
    });

    logger.info(`[Auto-Discovery] ${normalizedTicker} sisteme eklendi (${type})`);

    // 6. Arka planda enrichment yap
    enrichStockInfo(normalizedTicker).catch(() => {});

    return { action: 'created', ticker: normalizedTicker, stock: newStock };
  } catch (error) {
    return { action: 'error', ticker: normalizedTicker, error: error.message };
  }
}

/**
 * Çoklu hisse keşfi (Görev 38)
 */
export async function batchDiscover(tickers, delayMs = 300) {
  const results = { created: 0, existed: 0, failed: 0, details: [] };

  for (const ticker of tickers) {
    const result = await discoverAndRegister(ticker);
    results.details.push(result);
    
    if (result.action === 'created') results.created++;
    else if (result.action === 'exists') results.existed++;
    else results.failed++;

    await new Promise(r => setTimeout(r, delayMs));
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// HİSSE ARAMA (Görev 20 - Fuzzy Search)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hisse arama (ticker veya isim üzerinden)
 * Fuzzy matching ile sonuç döner
 */
export async function searchStocks(query, options = {}) {
  const { limit = 20, type, isActive = true, includeScore = false } = options;
  const searchTerm = query.toUpperCase().trim();

  if (!searchTerm || searchTerm.length < 1) {
    return [];
  }

  // DB'den tüm aktif hisseleri çek ve local'de filtrele (SQLite full-text yok)
  const where = {};
  if (isActive !== null) where.isActive = isActive;
  if (type) where.type = type;

  const allStocks = await prisma.stock.findMany({
    where,
    select: {
      ticker: true,
      name: true,
      sector: true,
      type: true,
      exchange: true,
      lastPrice: true,
      marketCap: true,
      isActive: true,
    },
    orderBy: { ticker: 'asc' },
  });

  // Fuzzy scoring
  const scored = allStocks.map(stock => {
    let score = 0;
    const ticker = stock.ticker.toUpperCase();
    const name = (stock.name || '').toUpperCase();
    const sector = (stock.sector || '').toUpperCase();

    // Exact ticker match
    if (ticker === searchTerm || ticker === `${searchTerm}.IS`) score += 100;
    // Ticker starts with
    else if (ticker.startsWith(searchTerm) || ticker.startsWith(`${searchTerm}`)) score += 80;
    // Ticker contains
    else if (ticker.includes(searchTerm)) score += 50;
    // Name starts with
    if (name.startsWith(searchTerm)) score += 40;
    // Name contains
    else if (name.includes(searchTerm)) score += 25;
    // Sector match
    if (sector.includes(searchTerm)) score += 15;

    return { ...stock, _score: score };
  });

  // Sadece eşleşenleri döndür
  const matched = scored
    .filter(s => s._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);

  if (!includeScore) {
    return matched.map(({ _score, ...rest }) => rest);
  }

  return matched;
}

// ═══════════════════════════════════════════════════════════════════════════
// HİSSE LİSTELEME (Görev 19 - Filtreli, Sayfalı)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hisse listeleme API (filtreleme, sıralama, sayfalama)
 */
export async function listStocks(options = {}) {
  const {
    page = 1,
    pageSize = 50,
    type,
    sector,
    exchange,
    isActive = true,
    sortBy = 'ticker',
    sortOrder = 'asc',
    minMarketCap,
    maxMarketCap,
    indexFilter, // 'bist30', 'bist100'
  } = options;

  const where = {};
  if (isActive !== null && isActive !== undefined) where.isActive = isActive;
  if (type) where.type = type;
  if (sector) where.sector = { contains: sector };
  if (exchange) where.exchange = exchange;
  if (minMarketCap || maxMarketCap) {
    where.marketCap = {};
    if (minMarketCap) where.marketCap.gte = parseFloat(minMarketCap);
    if (maxMarketCap) where.marketCap.lte = parseFloat(maxMarketCap);
  }

  // Endeks filtresi
  if (indexFilter) {
    let indexTickers = [];
    if (indexFilter === 'bist30') {
      indexTickers = (bistMaster.bist30 || []).map(t => `${t}.IS`);
    } else if (indexFilter === 'bist100') {
      const b30 = bistMaster.bist30 || [];
      const b100add = bistMaster.bist100Additions || [];
      indexTickers = [...b30, ...b100add].map(t => `${t}.IS`);
    }
    if (indexTickers.length > 0) {
      where.ticker = { in: indexTickers };
    }
  }

  // Sıralama
  const validSortFields = ['ticker', 'name', 'lastPrice', 'marketCap', 'sector', 'type'];
  const orderField = validSortFields.includes(sortBy) ? sortBy : 'ticker';
  const orderDir = sortOrder === 'desc' ? 'desc' : 'asc';

  const skip = (Math.max(1, page) - 1) * pageSize;
  const take = Math.min(pageSize, 200);

  const [stocks, total] = await prisma.$transaction([
    prisma.stock.findMany({
      where,
      include: { ratios: true },
      orderBy: { [orderField]: orderDir },
      skip,
      take,
    }),
    prisma.stock.count({ where }),
  ]);

  // Sektör dağılımı
  const sectorGroups = await prisma.stock.groupBy({
    by: ['sector'],
    where: { isActive: true },
    _count: { ticker: true },
    orderBy: { _count: { ticker: 'desc' } },
  });

  return {
    data: stocks,
    pagination: {
      page: Math.max(1, page),
      pageSize: take,
      total,
      totalPages: Math.ceil(total / take),
      hasNext: skip + take < total,
      hasPrev: page > 1,
    },
    filters: {
      availableSectors: sectorGroups.map(s => ({ sector: s.sector || 'Tanımsız', count: s._count.ticker })),
      availableTypes: ['bist', 'forex', 'crypto', 'commodity', 'index'],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BATCH PRİCE UPDATE (Görev 21-30)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Toplu fiyat güncelleme - Batch processing ile
 */
export async function batchUpdatePrices(options = {}) {
  const { type = 'bist', batchSize = 10, delayMs = 1000 } = options;

  const stocks = await prisma.stock.findMany({
    where: { isActive: true, type },
    select: { ticker: true },
    orderBy: { lastUpdate: 'asc' }, // En eski güncellenen önce
  });

  const results = { total: stocks.length, updated: 0, failed: 0, errors: [] };
  
  // Batch'ler halinde işle
  for (let i = 0; i < stocks.length; i += batchSize) {
    const batch = stocks.slice(i, i + batchSize);
    
    const promises = batch.map(async (stock) => {
      try {
        const price = await fetchCurrentPrice(stock.ticker);
        if (price) {
          await prisma.stock.update({
            where: { ticker: stock.ticker },
            data: { lastPrice: price, lastUpdate: new Date() },
          });
          results.updated++;
        }
      } catch (e) {
        results.failed++;
        results.errors.push({ ticker: stock.ticker, error: e.message });
      }
    });

    await Promise.all(promises);
    
    // Batch'ler arası bekleme (rate limit)
    if (i + batchSize < stocks.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  logger.info(`[BatchPrice] ${type}: ${results.updated}/${results.total} güncellendi`);
  return results;
}

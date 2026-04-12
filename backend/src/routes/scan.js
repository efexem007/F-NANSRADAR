/**
 * FinansRadar — Scan Routes (Queue-backed + Cache)
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { scanLimiter } from '../middleware/smartRateLimit.js';
import cache from '../lib/cache.js';
import { stockScannerQueue, getJobStatus, queueStats } from '../lib/queue.js';
import { scanAllStocks, scanSingleStock } from '../services/scanner.js';
import prisma from '../lib/prisma.js';

const router = Router();
router.use(authenticate);

// ─── Queue işleyicisi (tek kez tanımla) ───────────────────────────────────
stockScannerQueue.process(async (job) => {
  const { tickers } = job.data;
  const results = await scanAllStocks(tickers);
  // Cache'e kaydet
  await cache.set('scan:results:latest', results, 300);
  return { count: results.length };
});

// ─── Tek hisse tarama ──────────────────────────────────────────────────────
router.post('/stock/:ticker', scanLimiter, asyncHandler(async (req, res) => {
  const { ticker } = req.params;
  const cacheKey = `scan:single:${ticker}`;

  const cached = await cache.get(cacheKey);
  if (cached) return res.json({ ...cached, fromCache: true });

  const result = await scanSingleStock(ticker);
  await cache.set(cacheKey, result, cache.getDynamicTTL('scan'));
  res.json(result);
}));

// ─── Toplu tarama (async queue ile) ───────────────────────────────────────
router.post('/all', scanLimiter, asyncHandler(async (req, res) => {
  const { tickers } = req.body || {};
  const job = await stockScannerQueue.add('full-scan', { tickers });
  res.json({ message: 'Tarama arka planda başlatıldı', jobId: job.id });
}));

// ─── Job durumunu sorgula ──────────────────────────────────────────────────
router.get('/job/:jobId', asyncHandler(async (req, res) => {
  const status = await getJobStatus(req.params.jobId);
  if (!status) return res.status(404).json({ error: 'Job bulunamadı' });
  res.json(status);
}));

// ─── Son tarama sonuçlarını getir ─────────────────────────────────────────
router.get('/results', asyncHandler(async (req, res) => {
  const cacheKey = 'scan:results:latest';
  const cached = await cache.get(cacheKey);
  if (cached) return res.json({ results: cached, fromCache: true });

  const signals = await prisma.signalHistory.findMany({
    orderBy: { createdAt: 'desc' },
    distinct: ['ticker'],
    take: 50,
  });
  await cache.set(cacheKey, signals, 120);
  res.json({ results: signals });
}));

// ─── Queue istatistikleri ─────────────────────────────────────────────────
router.get('/queue-stats', (req, res) => {
  res.json(queueStats());
});

// ─── Cache temizle ────────────────────────────────────────────────────────
router.delete('/cache', asyncHandler(async (req, res) => {
  await cache.deleteCachePattern('scan:*');
  res.json({ message: 'Scan cache temizlendi' });
}));

export default router;

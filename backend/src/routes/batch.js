/**
 * FinansRadar — Batch Processing Routes
 * ======================================
 * Görev 21-30: Batch veri çekme, ilerleme takibi
 * Görev 37: Hisse ekleme ilerleme
 * Görev 40-45: İlerleme takip sistemi
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  batchFetchPriceHistory,
  batchCalculateIndicators,
  getJobProgress,
  getActiveJobs,
} from '../services/batchProcessor.js';

const router = Router();
router.use(authenticate);

// ─── Toplu fiyat verisi çekme ──────────────────────────────────────────────
router.post('/fetch-prices', asyncHandler(async (req, res) => {
  const { type = 'bist', period = '3mo', concurrency = 3, saveToDB = true, tickers } = req.body;

  // Async çalıştır, jobId döndür
  const result = await batchFetchPriceHistory({
    type,
    period,
    concurrency: Math.min(concurrency, 5),
    saveToDB,
    tickerFilter: tickers,
  });

  res.json(result);
}));

// ─── Toplu indikatör hesaplama ─────────────────────────────────────────────
router.post('/calculate-indicators', asyncHandler(async (req, res) => {
  const { type = 'bist', concurrency = 5 } = req.body;

  const result = await batchCalculateIndicators({
    type,
    concurrency: Math.min(concurrency, 10),
  });

  res.json(result);
}));

// ─── İş durumu sorgula ────────────────────────────────────────────────────
router.get('/job/:jobId', asyncHandler(async (req, res) => {
  const progress = getJobProgress(req.params.jobId);
  if (!progress) {
    return res.status(404).json({ error: 'Job bulunamadı' });
  }
  res.json(progress);
}));

// ─── Aktif işler ──────────────────────────────────────────────────────────
router.get('/jobs', (req, res) => {
  res.json({ jobs: getActiveJobs() });
});

export default router;

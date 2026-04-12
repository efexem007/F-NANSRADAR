const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { scanRateLimit } = require('../middleware/smartRateLimit');
const { addJob, getJobStatus, queues } = require('../lib/queue');
const cache = require('../lib/cache');
const logger = require('../lib/logger');

// Rate limiting
router.use(scanRateLimit);

// Hisse senedi tarama job'u oluştur
router.post('/stocks', asyncHandler(async (req, res) => {
  const { symbols, filters, userId } = req.body;

  if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'En az bir hisse senedi sembolü gereklidir',
    });
  }

  // Sembol limiti kontrolü
  if (symbols.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'En fazla 100 hisse senedi tarayabilirsiniz',
    });
  }

  // Job oluştur
  const job = await addJob('stockScanner', 'scan-stocks', {
    symbols: symbols.map(s => s.toUpperCase()),
    filters: filters || {},
    userId: userId || req.user?.id,
    requestedAt: new Date().toISOString(),
  }, {
    priority: req.user?.isPremium ? 1 : 5,
  });

  logger.info('Tarama job\'u oluşturuldu', {
    jobId: job.id,
    symbols: symbols.length,
    userId: userId || req.user?.id,
  });

  res.status(202).json({
    success: true,
    message: 'Tarama işlemi kuyruğa eklendi',
    data: {
      jobId: job.id,
      status: 'pending',
      estimatedTime: symbols.length * 2, // yaklaşık süre (saniye)
      queuePosition: await queues.stockScanner.getWaitingCount(),
    },
  });
}));

// Tek hisse senedi detaylı analiz
router.post('/stock/:symbol', asyncHandler(async (req, res) => {
  const { symbol } = req.params;
  const { analysisType = 'full' } = req.body;

  const cacheKey = `scan:stock:${symbol.toUpperCase()}:${analysisType}`;
  
  // Cache kontrolü
  const cached = await cache.get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      data: cached,
      cached: true,
    });
  }

  // Job oluştur
  const job = await addJob('stockScanner', 'analyze-stock', {
    symbol: symbol.toUpperCase(),
    analysisType,
    userId: req.user?.id,
  });

  res.status(202).json({
    success: true,
    message: 'Analiz işlemi kuyruğa eklendi',
    data: {
      jobId: job.id,
      status: 'pending',
      symbol: symbol.toUpperCase(),
    },
  });
}));

// Portföy taraması
router.post('/portfolio/:portfolioId', asyncHandler(async (req, res) => {
  const { portfolioId } = req.params;
  const { scanType = 'performance' } = req.body;

  const job = await addJob('portfolioSync', 'scan-portfolio', {
    portfolioId,
    scanType,
    userId: req.user?.id,
  });

  res.status(202).json({
    success: true,
    message: 'Portföy taraması kuyruğa eklendi',
    data: {
      jobId: job.id,
      status: 'pending',
      portfolioId,
    },
  });
}));

// Job durumunu sorgula
router.get('/job/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { queue = 'stockScanner' } = req.query;

  const status = await getJobStatus(queue, jobId);

  if (!status) {
    return res.status(404).json({
      success: false,
      error: 'Job bulunamadı',
    });
  }

  res.json({
    success: true,
    data: status,
  });
}));

// Çoklu job durumu sorgula
router.post('/jobs/status', asyncHandler(async (req, res) => {
  const { jobIds, queue = 'stockScanner' } = req.body;

  if (!Array.isArray(jobIds)) {
    return res.status(400).json({
      success: false,
      error: 'jobIds array olmalıdır',
    });
  }

  const statuses = await Promise.all(
    jobIds.map(id => getJobStatus(queue, id))
  );

  res.json({
    success: true,
    data: statuses.filter(Boolean),
  });
}));

// Job iptal et
router.delete('/job/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { queue = 'stockScanner' } = req.query;

  const { removeJob } = require('../lib/queue');
  const removed = await removeJob(queue, jobId);

  if (!removed) {
    return res.status(404).json({
      success: false,
      error: 'Job bulunamadı veya zaten işleniyor',
    });
  }

  res.json({
    success: true,
    message: 'Job iptal edildi',
  }));
}));

// Kuyruk istatistikleri
router.get('/stats', asyncHandler(async (req, res) => {
  const { getAllStats } = require('../lib/queue');
  const stats = await getAllStats();

  res.json({
    success: true,
    data: stats,
  });
}));

// Aktif job'ları listele
router.get('/jobs/active', asyncHandler(async (req, res) => {
  const { queue = 'stockScanner' } = req.query;
  const selectedQueue = queues[queue];

  if (!selectedQueue) {
    return res.status(400).json({
      success: false,
      error: 'Geçersiz kuyruk adı',
    });
  }

  const jobs = await selectedQueue.getActive();

  res.json({
    success: true,
    data: jobs.map(job => ({
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress(),
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    })),
  });
}));

// Bekleyen job'ları listele
router.get('/jobs/waiting', asyncHandler(async (req, res) => {
  const { queue = 'stockScanner', limit = 20 } = req.query;
  const selectedQueue = queues[queue];

  if (!selectedQueue) {
    return res.status(400).json({
      success: false,
      error: 'Geçersiz kuyruk adı',
    });
  }

  const jobs = await selectedQueue.getWaiting(0, parseInt(limit));

  res.json({
    success: true,
    data: jobs.map((job, index) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      queuePosition: index + 1,
      timestamp: job.timestamp,
    })),
  });
}));

// Tamamlanan job'ları listele
router.get('/jobs/completed', asyncHandler(async (req, res) => {
  const { queue = 'stockScanner', limit = 20 } = req.query;
  const selectedQueue = queues[queue];

  if (!selectedQueue) {
    return res.status(400).json({
      success: false,
      error: 'Geçersiz kuyruk adı',
    });
  }

  const jobs = await selectedQueue.getCompleted(0, parseInt(limit));

  res.json({
    success: true,
    data: jobs.map(job => ({
      id: job.id,
      name: job.name,
      data: job.data,
      result: job.returnvalue,
      finishedOn: job.finishedOn,
    })),
  });
}));

// Başarısız job'ları listele
router.get('/jobs/failed', asyncHandler(async (req, res) => {
  const { queue = 'stockScanner', limit = 20 } = req.query;
  const selectedQueue = queues[queue];

  if (!selectedQueue) {
    return res.status(400).json({
      success: false,
      error: 'Geçersiz kuyruk adı',
    });
  }

  const jobs = await selectedQueue.getFailed(0, parseInt(limit));

  res.json({
    success: true,
    data: jobs.map(job => ({
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
    })),
  });
}));

// Job'ı yeniden dene
router.post('/job/:jobId/retry', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { queue = 'stockScanner' } = req.query;
  const selectedQueue = queues[queue];

  if (!selectedQueue) {
    return res.status(400).json({
      success: false,
      error: 'Geçersiz kuyruk adı',
    });
  }

  const job = await selectedQueue.getJob(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job bulunamadı',
    });
  }

  await job.retry();

  res.json({
    success: true,
    message: 'Job yeniden deneniyor',
    data: { jobId },
  });
}));

module.exports = router;

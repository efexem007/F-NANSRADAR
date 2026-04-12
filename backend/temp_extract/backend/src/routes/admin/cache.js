const express = require('express');
const router = express.Router();
const { asyncHandler, AuthorizationError } = require('../../middleware/errorHandler');
const cache = require('../../lib/cache');
const logger = require('../../lib/logger');

// Admin kontrolü
const requireAdmin = (req, res, next) => {
  const apiKey = req.headers['x-admin-api-key'];
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({
      success: false,
      error: 'Yetkisiz erişim',
    });
  }
  next();
};

router.use(requireAdmin);

// Cache istatistikleri
router.get('/stats', asyncHandler(async (req, res) => {
  const info = await cache.client.info('stats');
  const dbSize = await cache.client.dbsize();
  
  res.json({
    success: true,
    data: {
      dbSize,
      info: info.split('\r\n').reduce((acc, line) => {
        const [key, value] = line.split(':');
        if (key && value) acc[key] = value;
        return acc;
      }, {}),
    },
  });
}));

// Cache key'leri listele
router.get('/keys', asyncHandler(async (req, res) => {
  const { pattern = '*', limit = 100 } = req.query;
  
  const keys = await cache.client.keys(pattern);
  const limitedKeys = keys.slice(0, parseInt(limit));
  
  const keyDetails = await Promise.all(
    limitedKeys.map(async (key) => {
      const ttl = await cache.client.ttl(key);
      const type = await cache.client.type(key);
      return { key, ttl, type };
    })
  );

  res.json({
    success: true,
    data: {
      total: keys.length,
      returned: keyDetails.length,
      keys: keyDetails,
    },
  });
}));

// Belirli key'i getir
router.get('/key/:key', asyncHandler(async (req, res) => {
  const { key } = req.params;
  
  const value = await cache.client.get(key);
  const ttl = await cache.client.ttl(key);
  
  if (!value) {
    return res.status(404).json({
      success: false,
      error: 'Key bulunamadı',
    });
  }

  res.json({
    success: true,
    data: {
      key,
      value: JSON.parse(value),
      ttl,
    },
  });
}));

// Key sil
router.delete('/key/:key', asyncHandler(async (req, res) => {
  const { key } = req.params;
  
  await cache.delete(key);
  logger.info(`Cache key silindi: ${key}`);

  res.json({
    success: true,
    message: 'Key silindi',
  });
}));

// Pattern ile sil
router.delete('/pattern', asyncHandler(async (req, res) => {
  const { pattern } = req.body;
  
  if (!pattern) {
    return res.status(400).json({
      success: false,
      error: 'Pattern gereklidir',
    });
  }

  const deleted = await cache.deletePattern(pattern);
  logger.info(`Cache pattern silindi: ${pattern} (${deleted} keys)`);

  res.json({
    success: true,
    message: `${deleted} key silindi`,
    deleted,
  });
}));

// Tüm cache'i temizle
router.delete('/flush', asyncHandler(async (req, res) => {
  await cache.flush();
  logger.warn('TÜM CACHE TEMİZLENDİ');

  res.json({
    success: true,
    message: 'Tüm cache temizlendi',
  });
}));

// Cache sağlık kontrolü
router.get('/health', asyncHandler(async (req, res) => {
  const health = await cache.health();
  
  res.json({
    success: true,
    data: health,
  });
}));

module.exports = router;

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const logger = require('../lib/logger');

// Redis client for rate limiting
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_RATE_LIMIT_DB || 2,
});

// Endpoint bazlı limit konfigürasyonları
const endpointLimits = {
  // Yahoo Finance kullanan endpoint'ler - daha düşük limit
  '/api/stock': {
    windowMs: 60 * 1000, // 1 dakika
    max: 30,
    message: 'Çok fazla hisse senedi isteği. Lütfen 1 dakika sonra tekrar deneyin.',
  },
  '/api/stock/search': {
    windowMs: 60 * 1000,
    max: 20,
    message: 'Çok fazla arama isteği. Lütfen bekleyin.',
  },
  '/api/stock/price': {
    windowMs: 60 * 1000,
    max: 60,
    message: 'Çok fazla fiyat isteği.',
  },
  
  // Tarama endpoint'leri
  '/api/scan': {
    windowMs: 60 * 1000,
    max: 20,
    message: 'Çok fazla tarama isteği.',
  },
  '/api/scan/job': {
    windowMs: 60 * 1000,
    max: 60,
    message: 'Çok fazla job sorgusu.',
  },
  
  // Portföy endpoint'leri
  '/api/portfolio': {
    windowMs: 60 * 1000,
    max: 100,
    message: 'Çok fazla portföy isteği.',
  },
  
  // Auth endpoint'leri - daha katı limit
  '/api/auth': {
    windowMs: 15 * 60 * 1000, // 15 dakika
    max: 10,
    message: 'Çok fazla giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
  },
  '/api/auth/register': {
    windowMs: 60 * 60 * 1000, // 1 saat
    max: 5,
    message: 'Saatlik kayıt limitine ulaştınız.',
  },
  
  // Varsayılan limit
  default: {
    windowMs: 60 * 1000,
    max: 100,
    message: 'Çok fazla istek. Lütfen bekleyin.',
  },
};

// Key generator - IP + User ID
const keyGenerator = (req) => {
  const userId = req.user?.id || 'anonymous';
  const ip = req.ip || req.connection.remoteAddress;
  return `${ip}:${userId}`;
};

// Skip fonksiyonu - admin kullanıcıları atla
const skip = (req) => {
  return req.user?.role === 'admin';
};

// Rate limit middleware oluşturucu
const createRateLimiter = (options = {}) => {
  const config = { ...endpointLimits.default, ...options };
  
  return rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:',
    }),
    windowMs: config.windowMs,
    max: config.max,
    message: {
      success: false,
      error: config.message,
      retryAfter: Math.ceil(config.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skip,
    handler: (req, res, next, options) => {
      logger.warn('Rate limit aşıldı', {
        ip: req.ip,
        userId: req.user?.id,
        path: req.originalUrl,
        limit: options.max,
      });
      
      res.status(429).json(options.message);
    },
  });
};

// Dinamik rate limit middleware
const smartRateLimit = (req, res, next) => {
  const path = req.originalUrl;
  
  // En uygun limit konfigürasyonunu bul
  let config = endpointLimits.default;
  for (const [endpoint, endpointConfig] of Object.entries(endpointLimits)) {
    if (path.startsWith(endpoint)) {
      config = endpointConfig;
      break;
    }
  }
  
  // Rate limiter'ı uygula
  const limiter = createRateLimiter(config);
  return limiter(req, res, next);
};

// Belirli endpoint'ler için özel limiter'lar
const stockRateLimit = createRateLimiter(endpointLimits['/api/stock']);
const scanRateLimit = createRateLimiter(endpointLimits['/api/scan']);
const authRateLimit = createRateLimiter(endpointLimits['/api/auth']);
const portfolioRateLimit = createRateLimiter(endpointLimits['/api/portfolio']);

// Brute force koruması (auth için)
const bruteForceProtection = (options = {}) => {
  const { maxAttempts = 5, lockTime = 15 * 60 * 1000 } = options;
  
  const attempts = new Map();
  
  return async (req, res, next) => {
    const key = `${req.ip}:${req.body.email || req.body.username || 'unknown'}`;
    const now = Date.now();
    
    const record = attempts.get(key);
    
    if (record) {
      // Kilitli mi kontrol et
      if (record.lockedUntil && now < record.lockedUntil) {
        const remaining = Math.ceil((record.lockedUntil - now) / 1000);
        return res.status(429).json({
          success: false,
          error: `Çok fazla başarısız deneme. ${remaining} saniye sonra tekrar deneyin.`,
          locked: true,
          retryAfter: remaining,
        });
      }
      
      // Kilidi aç
      if (record.lockedUntil && now >= record.lockedUntil) {
        attempts.delete(key);
      }
    }
    
    // Yanıtı yakala
    const originalJson = res.json;
    res.json = function(data) {
      if (res.statusCode === 401 || res.statusCode === 403) {
        // Başarısız deneme
        const current = attempts.get(key) || { count: 0, firstAttempt: now };
        current.count++;
        
        if (current.count >= maxAttempts) {
          current.lockedUntil = now + lockTime;
          logger.warn('Brute force koruması aktif', {
            ip: req.ip,
            email: req.body.email,
            attempts: current.count,
          });
        }
        
        attempts.set(key, current);
      } else if (res.statusCode === 200 && data.success) {
        // Başarılı giriş - sıfırla
        attempts.delete(key);
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Rate limit durumunu kontrol et
const checkRateLimitStatus = async (identifier) => {
  const keys = await redisClient.keys(`rl:*${identifier}*`);
  const status = [];
  
  for (const key of keys) {
    const ttl = await redisClient.ttl(key);
    const value = await redisClient.get(key);
    status.push({ key, ttl, requests: value });
  }
  
  return status;
};

module.exports = {
  smartRateLimit,
  stockRateLimit,
  scanRateLimit,
  authRateLimit,
  portfolioRateLimit,
  bruteForceProtection,
  createRateLimiter,
  checkRateLimitStatus,
  endpointLimits,
};

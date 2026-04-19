/**
 * FinansRadar — Smart Endpoint-Based Rate Limiter
 */

import rateLimit from 'express-rate-limit';

// ─── Endpoint bazlı limitler ───────────────────────────────────────────────
const LIMITS = {
  auth:      { windowMs: 1 * 60 * 1000, max: 1000, message: 'Çok fazla giriş denemesi' },
  stock:     { windowMs:     60 * 1000, max: 2000, message: 'Stok API limiti aşıldı' },
  scan:      { windowMs: 1 * 60 * 1000, max: 500,  message: 'Tarama limiti aşıldı' },
  universal: { windowMs: 1 * 60 * 1000, max: 500,  message: 'Universal tarama limiti aşıldı' },
  macro:     { windowMs: 1 * 60 * 1000, max: 1000, message: 'Makro veri limiti aşıldı' },
  report:    { windowMs: 1 * 60 * 1000, max: 500,  message: 'Rapor oluşturma limiti aşıldı' },
  portfolio: { windowMs: 1 * 60 * 1000, max: 2000, message: 'Portföy API limiti aşıldı' },
  watchlist: { windowMs: 1 * 60 * 1000, max: 2000, message: 'Watchlist API limiti aşıldı' },
  default:   { windowMs: 1 * 60 * 1000, max: 5000, message: 'İstek limiti aşıldı' },
};

function makeLimit(config) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: config.message,
        code: 'RATE_LIMIT',
        retryAfter: Math.ceil(config.windowMs / 1000),
      });
    },
  });
}

export const authLimiter      = makeLimit(LIMITS.auth);
export const stockLimiter     = makeLimit(LIMITS.stock);
export const scanLimiter      = makeLimit(LIMITS.scan);
export const universalLimiter = makeLimit(LIMITS.universal);
export const macroLimiter     = makeLimit(LIMITS.macro);
export const reportLimiter    = makeLimit(LIMITS.report);
export const portfolioLimiter = makeLimit(LIMITS.portfolio);
export const watchlistLimiter = makeLimit(LIMITS.watchlist);
export const defaultLimiter   = makeLimit(LIMITS.default);

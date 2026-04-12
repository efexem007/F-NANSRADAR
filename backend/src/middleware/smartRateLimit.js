/**
 * FinansRadar — Smart Endpoint-Based Rate Limiter
 */

import rateLimit from 'express-rate-limit';

// ─── Endpoint bazlı limitler ───────────────────────────────────────────────
const LIMITS = {
  auth:      { windowMs: 15 * 60 * 1000, max: 10,  message: 'Çok fazla giriş denemesi, 15 dakika bekleyin' },
  stock:     { windowMs:       60 * 1000, max: 30,  message: 'Stok API limiti aşıldı, 1 dakika bekleyin'   },
  scan:      { windowMs:  5 * 60 * 1000, max: 10,  message: 'Tarama limiti aşıldı, 5 dakika bekleyin'     },
  universal: { windowMs:  5 * 60 * 1000, max: 10,  message: 'Universal tarama limiti aşıldı'              },
  macro:     { windowMs: 10 * 60 * 1000, max: 20,  message: 'Makro veri limiti aşıldı'                    },
  report:    { windowMs: 60 * 60 * 1000, max: 5,   message: 'Rapor oluşturma limiti aşıldı'               },
  default:   { windowMs: 15 * 60 * 1000, max: 200, message: 'İstek limiti aşıldı'                         },
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
export const defaultLimiter   = makeLimit(LIMITS.default);

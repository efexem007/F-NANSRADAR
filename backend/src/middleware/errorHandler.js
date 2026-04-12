/**
 * FinansRadar — Centralized Error Handler Middleware
 */

import logger from '../lib/logger.js';

// ─── Custom HTTP Error Sınıfı ──────────────────────────────────────────────
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} bulunamadı`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Kimlik doğrulaması gerekli') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Çok fazla istek gönderildi') {
    super(message, 429, 'RATE_LIMIT');
  }
}

// ─── Ana Error Handler (Express) ──────────────────────────────────────────
export function errorHandler(err, req, res, next) {
  // Yanıt zaten gönderildiyse Express'e devret
  if (res.headersSent) return next(err);

  const statusCode = err.statusCode || (err.status) || 500;
  const isOperational = err.isOperational === true;
  const isDev = process.env.NODE_ENV !== 'production';

  // Loglama
  if (statusCode >= 500) {
    logger.error('Sunucu hatası', {
      url:    req.originalUrl,
      method: req.method,
      status: statusCode,
      error:  err.message,
      stack:  isDev ? err.stack : undefined,
    });
  } else if (statusCode >= 400) {
    logger.warn('İstek hatası', {
      url:    req.originalUrl,
      method: req.method,
      status: statusCode,
      error:  err.message,
    });
  }

  // Prisma hataları
  if (err.constructor?.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Kayıt bulunamadı', code: 'NOT_FOUND' });
    if (err.code === 'P2002') return res.status(409).json({ success: false, error: 'Bu kayıt zaten mevcut', code: 'CONFLICT' });
  }

  // Zod validation
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: 'Doğrulama hatası',
      code: 'VALIDATION_ERROR',
      details: err.errors?.map(e => ({ field: e.path.join('.'), message: e.message })),
    });
  }

  // JWT hataları
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, error: 'Geçersiz token', code: 'UNAUTHORIZED' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: 'Token süresi doldu', code: 'TOKEN_EXPIRED' });
  }

  res.status(statusCode).json({
    success: false,
    error: isOperational ? err.message : 'Sunucuda bir hata oluştu',
    code:  err.code || 'INTERNAL_ERROR',
    ...(isDev && !isOperational && { stack: err.stack }),
  });
}

// ─── 404 Handler ──────────────────────────────────────────────────────────
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `${req.originalUrl} — bu endpoint bulunamadı`,
    code: 'NOT_FOUND',
  });
}

const logger = require('../lib/logger');

// Özel hata sınıfları
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Yetkilendirme hatası') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Erişim reddedildi') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Kaynak') {
    super(`${resource} bulunamadı`, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Çakışma hatası') {
    super(message, 409, 'CONFLICT');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Çok fazla istek', retryAfter = 60) {
    super(message, 429, 'RATE_LIMIT');
    this.retryAfter = retryAfter;
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message) {
    super(`${service} hatası: ${message}`, 502, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
  }
}

// Prisma hata kodları
const prismaErrorCodes = {
  P2000: { status: 400, code: 'VALUE_TOO_LONG', message: 'Değer çok uzun' },
  P2001: { status: 404, code: 'RECORD_NOT_FOUND', message: 'Kayıt bulunamadı' },
  P2002: { status: 409, code: 'UNIQUE_CONSTRAINT', message: 'Benzersiz kısıtlama ihlali' },
  P2003: { status: 400, code: 'FOREIGN_KEY_CONSTRAINT', message: 'Foreign key kısıtlama hatası' },
  P2025: { status: 404, code: 'RECORD_NOT_FOUND', message: 'Kayıt bulunamadı' },
};

// JWT hataları
const jwtErrors = {
  TokenExpiredError: { status: 401, code: 'TOKEN_EXPIRED', message: 'Token süresi doldu' },
  JsonWebTokenError: { status: 401, code: 'INVALID_TOKEN', message: 'Geçersiz token' },
  NotBeforeError: { status: 401, code: 'TOKEN_NOT_ACTIVE', message: 'Token henüz aktif değil' },
};

// Hata dönüşüm fonksiyonu
const convertError = (err) => {
  // Prisma hataları
  if (err.code && prismaErrorCodes[err.code]) {
    const config = prismaErrorCodes[err.code];
    const error = new AppError(config.message, config.status, config.code);
    error.originalError = err;
    return error;
  }

  // JWT hataları
  if (err.name && jwtErrors[err.name]) {
    const config = jwtErrors[err.name];
    return new AppError(config.message, config.status, config.code);
  }

  // Validation hataları
  if (err.name === 'ValidationError' || err.name === 'ZodError') {
    return new ValidationError(
      'Doğrulama hatası',
      err.errors || [err.message]
    );
  }

  // Syntax hataları
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return new AppError('Geçersiz JSON formatı', 400, 'INVALID_JSON');
  }

  return err;
};

// Ana error handler middleware
const errorHandler = (err, req, res, next) => {
  // Hatayı dönüştür
  err = convertError(err);

  // Status code belirle
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Loglama
  if (err.statusCode >= 500) {
    logger.error('Sunucu hatası', {
      error: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id,
      code: err.code,
    });
  } else {
    logger.warn('İstemci hatası', {
      error: err.message,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userId: req.user?.id,
      code: err.code,
      statusCode: err.statusCode,
    });
  }

  // Geliştirme vs Production yanıtı
  const isDev = process.env.NODE_ENV === 'development';

  const response = {
    success: false,
    error: err.message,
    code: err.code || 'INTERNAL_ERROR',
    ...(err.errors && { errors: err.errors }),
    ...(err.retryAfter && { retryAfter: err.retryAfter }),
  };

  if (isDev) {
    response.stack = err.stack;
    response.originalError = err.originalError?.message;
  }

  res.status(err.statusCode).json(response);
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl}`));
};

// Async wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Request validation wrapper
const validateRequest = (schema) => {
  return asyncHandler(async (req, res, next) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      throw new ValidationError('Doğrulama hatası', error.errors);
    }
  });
};

// Global hata yakalayıcı
const setupGlobalErrorHandlers = () => {
  // Uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error('Yakalanmamış istisna', {
      error: err.message,
      stack: err.stack,
    });
    
    // Graceful shutdown
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  // Unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('İşlenmeyen promise reddi', {
      reason: reason?.message || reason,
      stack: reason?.stack,
    });
  });
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ExternalServiceError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validateRequest,
  setupGlobalErrorHandlers,
};

// Async route handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Retry mekanizmalı async handler
const asyncHandlerWithRetry = (fn, options = {}) => {
  const { retries = 3, delay = 1000, backoff = 2 } = options;
  
  return async (req, res, next) => {
    let lastError;
    let currentDelay = delay;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn(req, res, next);
      } catch (error) {
        lastError = error;
        
        // Retry edilemeyecek hatalar
        if (error.statusCode === 400 || error.statusCode === 401 || 
            error.statusCode === 403 || error.statusCode === 404) {
          return next(error);
        }
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, currentDelay));
          currentDelay *= backoff;
        }
      }
    }
    
    next(lastError);
  };
};

// Batch işlem handler'ı
const batchHandler = (fn, options = {}) => {
  const { batchSize = 100, concurrency = 5 } = options;
  
  return async (items, ...args) => {
    const results = [];
    const errors = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Concurrency limitli batch işleme
      const batchPromises = batch.map(async (item, index) => {
        const slot = index % concurrency;
        await new Promise(resolve => setTimeout(resolve, slot * 50)); // Staggered start
        
        try {
          const result = await fn(item, ...args);
          return { success: true, result, item };
        } catch (error) {
          return { success: false, error: error.message, item };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      batchResults.forEach(({ success, result, error, item }) => {
        if (success) {
          results.push(result);
        } else {
          errors.push({ item, error });
        }
      });
    }
    
    return { results, errors, totalProcessed: items.length };
  };
};

// Timeout wrapper
const withTimeout = (fn, timeoutMs = 5000) => {
  return async (...args) => {
    return Promise.race([
      fn(...args),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  };
};

// Debounce wrapper
const debounce = (fn, wait = 300) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    return new Promise((resolve) => {
      timeout = setTimeout(() => resolve(fn(...args)), wait);
    });
  };
};

module.exports = {
  asyncHandler,
  asyncHandlerWithRetry,
  batchHandler,
  withTimeout,
  debounce,
};

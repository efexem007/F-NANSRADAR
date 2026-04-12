const Redis = require('ioredis');
const logger = require('./logger');

class CacheService {
  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.circuitBreaker = {
      failures: 0,
      lastFailure: null,
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      threshold: 5,
      timeout: 30000, // 30 saniye
    };

    this.client.on('connect', () => {
      logger.info('Redis bağlantısı kuruldu');
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failures = 0;
    });

    this.client.on('error', (err) => {
      logger.error('Redis hatası:', err.message);
      this.handleFailure();
    });
  }

  handleFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();
    
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.state = 'OPEN';
      logger.warn('Circuit Breaker AÇIK - Redis devre dışı');
    }
  }

  isCircuitOpen() {
    if (this.circuitBreaker.state === 'OPEN') {
      if (Date.now() - this.circuitBreaker.lastFailure > this.circuitBreaker.timeout) {
        this.circuitBreaker.state = 'HALF_OPEN';
        logger.info('Circuit Breaker YARI-AÇIK - Test ediliyor');
        return false;
      }
      return true;
    }
    return false;
  }

  // Piyasa saatlerini kontrol et (Türkiye saati)
  isMarketOpen() {
    const now = new Date();
    const turkeyTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
    const day = turkeyTime.getDay();
    const hour = turkeyTime.getHours();
    const minute = turkeyTime.getMinutes();
    const time = hour * 60 + minute;

    // Hafta sonu kontrolü
    if (day === 0 || day === 6) return false;

    // Seans saatleri: 09:30 - 18:00
    const marketOpen = 9 * 60 + 30;  // 09:30
    const marketClose = 18 * 60;      // 18:00

    return time >= marketOpen && time <= marketClose;
  }

  // Dinamik TTL hesaplama
  getTTL(customTTL = null) {
    if (customTTL) return customTTL;
    return this.isMarketOpen() ? 30 : 3600; // 30 saniye veya 1 saat
  }

  async get(key) {
    if (this.isCircuitOpen()) {
      logger.warn(`Circuit açık, cache atlanıyor: ${key}`);
      return null;
    }

    try {
      const data = await this.client.get(key);
      if (data) {
        logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(data);
      }
      logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache get hatası (${key}):`, error.message);
      this.handleFailure();
      return null;
    }
  }

  async set(key, value, ttl = null) {
    if (this.isCircuitOpen()) {
      logger.warn(`Circuit açık, cache yazılmıyor: ${key}`);
      return false;
    }

    try {
      const finalTTL = this.getTTL(ttl);
      await this.client.setex(key, finalTTL, JSON.stringify(value));
      logger.debug(`Cache SET: ${key} (TTL: ${finalTTL}s)`);
      
      if (this.circuitBreaker.state === 'HALF_OPEN') {
        this.circuitBreaker.state = 'CLOSED';
        this.circuitBreaker.failures = 0;
      }
      return true;
    } catch (error) {
      logger.error(`Cache set hatası (${key}):`, error.message);
      this.handleFailure();
      return false;
    }
  }

  async delete(key) {
    try {
      await this.client.del(key);
      logger.debug(`Cache DELETE: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Cache delete hatası (${key}):`, error.message);
      return false;
    }
  }

  async deletePattern(pattern) {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
        logger.info(`Cache pattern silindi: ${pattern} (${keys.length} keys)`);
      }
      return keys.length;
    } catch (error) {
      logger.error(`Cache pattern delete hatası (${pattern}):`, error.message);
      return 0;
    }
  }

  async getOrSet(key, factory, ttl = null) {
    const cached = await this.get(key);
    if (cached !== null) return cached;

    const value = await factory();
    if (value !== null && value !== undefined) {
      await this.set(key, value, ttl);
    }
    return value;
  }

  async flush() {
    try {
      await this.client.flushdb();
      logger.info('Cache tamamen temizlendi');
      return true;
    } catch (error) {
      logger.error('Cache flush hatası:', error.message);
      return false;
    }
  }

  async health() {
    try {
      await this.client.ping();
      return { status: 'healthy', circuitState: this.circuitBreaker.state };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, circuitState: this.circuitBreaker.state };
    }
  }
}

module.exports = new CacheService();

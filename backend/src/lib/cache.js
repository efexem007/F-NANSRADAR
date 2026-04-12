/**
 * FinansRadar — Redis Cache Sistemi
 * In-memory fallback + isteğe bağlı Redis desteği
 * Redis yoksa otomatik fallback → Map tabanlı memory cache
 */

import { createClient } from 'redis';

// ─── Basit in-memory cache (Redis yokken fallback) ─────────────────────────
class MemoryCache {
  constructor() {
    this.store = new Map();
    this.timers = new Map();
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key, value, ttlSeconds = 60) {
    if (this.timers.has(key)) clearTimeout(this.timers.get(key));
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
    if (ttlSeconds > 0) {
      const timer = setTimeout(() => this.store.delete(key), ttlSeconds * 1000);
      this.timers.set(key, timer);
    }
    return true;
  }

  async del(key) {
    if (this.timers.has(key)) clearTimeout(this.timers.get(key));
    return this.store.delete(key);
  }

  async keys(pattern) {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    return [...this.store.keys()].filter(k => regex.test(k));
  }

  async flushAll() {
    this.timers.forEach(t => clearTimeout(t));
    this.store.clear();
    this.timers.clear();
  }

  get size() { return this.store.size; }
}

// ─── Cache Manager ──────────────────────────────────────────────────────────
class CacheManager {
  constructor() {
    this.client = null;
    this.memory = new MemoryCache();
    this.isRedisConnected = false;
    this.hits = 0;
    this.misses = 0;
  }

  async connect() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.log('📦 Cache: Redis URL bulunamadı, in-memory cache kullanılıyor');
      return;
    }

    try {
      this.client = createClient({ url: redisUrl, socket: { connectTimeout: 3000 } });
      this.client.on('error', (err) => {
        if (this.isRedisConnected) {
          console.warn('⚠️  Redis bağlantı hatası, in-memory cache\'e geçildi:', err.message);
          this.isRedisConnected = false;
        }
      });
      this.client.on('connect', () => {
        this.isRedisConnected = true;
        console.log('✅ Redis bağlandı');
      });
      await this.client.connect();
    } catch (err) {
      console.log('📦 Cache: Redis bağlanamadı, in-memory cache kullanılıyor');
      this.client = null;
    }
  }

  // ─── Piyasa açık mı? (TTL hesaplama için) ─────────────────────────────
  isMarketOpen() {
    const now = new Date();
    const hour = now.getUTCHours() + 3; // UTC+3 (İstanbul)
    const day = now.getDay();
    return day >= 1 && day <= 5 && hour >= 10 && hour < 18;
  }

  // ─── Dinamik TTL ───────────────────────────────────────────────────────
  getDynamicTTL(type = 'price') {
    const TTL = {
      price:     this.isMarketOpen() ? 30    : 3600,   // Canlı: 30sn / Kapalı: 1saat
      analysis:  this.isMarketOpen() ? 120   : 7200,   // 2dk / 2saat
      scan:      this.isMarketOpen() ? 300   : 3600,   // 5dk / 1saat
      macro:     3600,                                   // Daima 1 saat
      static:    86400,                                  // 24 saat
      default:   60,
    };
    return TTL[type] || TTL.default;
  }

  // ─── GET ───────────────────────────────────────────────────────────────
  async get(key) {
    try {
      let value = null;
      if (this.isRedisConnected && this.client) {
        const raw = await this.client.get(key);
        value = raw ? JSON.parse(raw) : null;
      } else {
        value = await this.memory.get(key);
      }
      if (value !== null) this.hits++;
      else this.misses++;
      return value;
    } catch {
      return await this.memory.get(key);
    }
  }

  // ─── SET ───────────────────────────────────────────────────────────────
  async set(key, value, ttlSeconds) {
    const ttl = ttlSeconds ?? this.getDynamicTTL();
    try {
      if (this.isRedisConnected && this.client) {
        await this.client.set(key, JSON.stringify(value), { EX: ttl });
      } else {
        await this.memory.set(key, value, ttl);
      }
    } catch {
      await this.memory.set(key, value, ttl);
    }
  }

  // ─── DEL ───────────────────────────────────────────────────────────────
  async del(key) {
    try {
      if (this.isRedisConnected && this.client) await this.client.del(key);
      await this.memory.del(key);
    } catch { /* ignore */ }
  }

  // ─── Pattern Invalidation ──────────────────────────────────────────────
  async deleteCachePattern(pattern) {
    try {
      if (this.isRedisConnected && this.client) {
        const keys = await this.client.keys(pattern);
        if (keys.length) await this.client.del(keys);
      }
      const memKeys = await this.memory.keys(pattern);
      for (const k of memKeys) await this.memory.del(k);
    } catch { /* ignore */ }
  }

  // ─── Cache-or-fetch helper ─────────────────────────────────────────────
  async getOrSet(key, fetchFn, ttlType = 'default') {
    const cached = await this.get(key);
    if (cached !== null) return cached;
    const value = await fetchFn();
    await this.set(key, value, this.getDynamicTTL(ttlType));
    return value;
  }

  // ─── Stats ────────────────────────────────────────────────────────────
  stats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total ? `${((this.hits / total) * 100).toFixed(1)}%` : '0%',
      engine: this.isRedisConnected ? 'redis' : 'memory',
      memorySize: this.memory.size,
    };
  }
}

const cache = new CacheManager();
export default cache;
export { CacheManager };

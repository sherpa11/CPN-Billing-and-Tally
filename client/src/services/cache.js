/**
 * High-performance in-memory cache with controlled TTL and event-driven invalidation.
 * Used for stable master data (vegetables, settings) to eliminate redundant network round-trips.
 */
class CacheService {
  constructor() {
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlMs = 5 * 60 * 1000) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs,
    });
  }

  invalidate(key) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

export const appCache = new CacheService();
export default appCache;

/* ========================================
   Cache Service - Memory + File cache
   ======================================== */

const fs = require('fs');
const config = require('../config');

class CacheService {
    constructor() {
        this._memoryCache = {};
        this._officersCache = null;
        this._cacheTimestamps = {};
    }

    /**
     * Get value from memory cache
     */
    get(key) {
        if (key === 'officers') {
            if (this._officersCache && Date.now() - (this._cacheTimestamps['officers'] || 0) < config.CACHE_TTL) {
                return this._officersCache;
            }
            return null;
        }
        
        const entry = this._memoryCache[key];
        if (entry && Date.now() - entry.timestamp < config.CACHE_TTL) {
            return entry.data;
        }
        return null;
    }

    /**
     * Set value in memory cache
     */
    set(key, data) {
        // Auto-clean if too many keys (prevent memory leak)
        if (Object.keys(this._cacheTimestamps).length > config.MAX_CACHE_KEYS) {
            this.clearAll();
        }

        if (key === 'officers') {
            this._officersCache = data;
        } else {
            this._memoryCache[key] = { data, timestamp: Date.now() };
        }
        this._cacheTimestamps[key] = Date.now();
    }

    /**
     * Remove specific key from cache
     */
    invalidate(key) {
        if (key === 'officers') {
            this._officersCache = null;
        } else {
            delete this._memoryCache[key];
        }
        delete this._cacheTimestamps[key];
    }

    /**
     * Clear all memory cache
     */
    clearAll() {
        this._officersCache = null;
        this._memoryCache = {};
        this._cacheTimestamps = {};
    }

    // ======== FILE CACHE (for Render wake-up resilience) ========

    /**
     * Load officers from file cache
     */
    loadFileCache() {
        try {
            if (fs.existsSync(config.CACHE_FILE)) {
                const raw = fs.readFileSync(config.CACHE_FILE, 'utf-8');
                const data = JSON.parse(raw);
                if (Date.now() - data.timestamp < config.FILE_CACHE_TTL) {
                    this._officersCache = data.officers;
                    console.log(`📦 Loaded ${data.officers.length} officers from file cache`);
                    return true;
                } else {
                    console.log('📦 File cache expired, will fetch fresh data');
                    fs.unlink(config.CACHE_FILE, () => {});
                }
            }
        } catch (e) {
            console.warn('⚠️ Failed to load file cache:', e.message);
        }
        return false;
    }

    /**
     * Save officers to file cache
     */
    saveFileCache(officers) {
        try {
            fs.writeFileSync(config.CACHE_FILE, JSON.stringify({
                timestamp: Date.now(),
                officers
            }), 'utf-8');
        } catch (e) {
            console.warn('⚠️ Failed to save file cache:', e.message);
        }
    }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
/* ========================================
   API Service - Single gateway for all server calls
   - Caching layer for faster repeated requests
   ======================================== */

const ApiService = {
    /** Simple in-memory cache */
    _cache: {},
    _cacheTTL: 60000, // 60 seconds default

    /**
     * Get cached value or fetch fresh data
     */
    _getCached(key) {
        const entry = this._cache[key];
        if (entry && Date.now() - entry.timestamp < this._cacheTTL) {
            return entry.data;
        }
        return null;
    },

    _setCache(key, data) {
        this._cache[key] = {
            data,
            timestamp: Date.now()
        };
    },

    _clearCache(prefix) {
        if (prefix) {
            Object.keys(this._cache).forEach(key => {
                if (key.startsWith(prefix)) delete this._cache[key];
            });
        } else {
            this._cache = {};
        }
    },

    /**
     * Generic fetch wrapper with error handling + caching
     */
    async fetch(url, cacheKey = null) {
        // Check cache first
        if (cacheKey) {
            const cached = this._getCached(cacheKey);
            if (cached) return cached;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();

        // Cache the result
        if (cacheKey) {
            this._setCache(cacheKey, data);
        }

        return data;
    },

    /**
     * Get all officers from server
     */
    async getOfficers() {
        return this.fetch('/api/officers', 'officers');
    },

    /**
     * Get all week names
     */
    async getWeeks() {
        return this.fetch('/api/weeks', 'weeks');
    },

    /**
     * Get week data for a specific week
     */
    async getWeekData(weekName) {
        return this.fetch(`/api/week-data?name=${encodeURIComponent(weekName)}`, `week:${weekName}`);
    },

    /**
     * Get static rules data
     */
    async getRules() {
        return this.fetch('/api/rules', 'rules');
    },

    /**
     * Get static conduct data
     */
    async getConduct() {
        return this.fetch('/api/conduct', 'conduct');
    },

    /**
     * Get static fines data
     */
    async getFines() {
        return this.fetch('/api/fines', 'fines');
    },

    /**
     * Get schedule configuration
     */
    async getScheduleConfig() {
        return this.fetch('/api/schedule-config', 'schedule-config');
    },

    /**
     * Clear specific cache (useful after mutations)
     */
    clearCache(prefix) {
        this._clearCache(prefix);
    },

    /**
     * Patch a specific week's cache to update paid status immediately.
     * Prevents stale cache data from reverting optimistic UI updates
     * when Google Sheets propagation hasn't completed yet.
     */
    patchCacheWeek(weekName, officerName, paidStatus = 'จ่ายแล้ว') {
        const cacheKey = 'week:' + weekName;
        const entry = this._cache[cacheKey];
        if (entry && entry.data) {
            const search = (officerName || '').trim().toLowerCase();
            for (const key of Object.keys(entry.data)) {
                const fullKey = (key || '').toLowerCase();
                if (fullKey === search || search.includes(fullKey) || fullKey.includes(search)) {
                    entry.data[key].paid = paidStatus;
                    break;
                }
            }
        }
    }
};
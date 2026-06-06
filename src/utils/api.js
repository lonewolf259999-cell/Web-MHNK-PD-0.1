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
        return this.fetch(`/api/week-data?name=${encodeURIComponent(weekName)}`, `week_${weekName}`);
    },

    /**
     * Get rules data from Google Sheets
     */
    async getRules() {
        return this.fetch('/api/rules-data/rules', 'rules_data');
    },

    /**
     * Get conduct data from Google Sheets
     */
    async getConduct() {
        return this.fetch('/api/rules-data/conduct', 'conduct_data');
    },

    /**
     * Get fines data from Google Sheets
     */
    async getFines() {
        return this.fetch('/api/rules-data/fines', 'fines_data');
    },

    /**
     * Add new rule/conduct/fine
     */
    async addRule(type, data, pin) {
        const response = await fetch(`/api/rules-data/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, pin })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to add rule');
        }
        // Clear client cache so next read fetches fresh data
        // Cache key format: {type}_data (e.g. 'rules_data', 'conduct_data', 'fines_data')
        this._clearCache(type + '_data');
        return response.json();
    },

    /**
     * Update existing rule/conduct/fine
     */
    async updateRule(type, id, data, pin) {
        const response = await fetch(`/api/rules-data/${type}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, pin })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to update rule');
        }
        // Clear client cache: {type}_data
        this._clearCache(type + '_data');
        return response.json();
    },

    /**
     * Delete rule/conduct/fine
     */
    async deleteRule(type, id, pin) {
        const response = await fetch(`/api/rules-data/${type}/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to delete rule');
        }
        // Clear client cache: {type}_data
        this._clearCache(type + '_data');
        return response.json();
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
        const cacheKey = 'week_' + weekName;
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
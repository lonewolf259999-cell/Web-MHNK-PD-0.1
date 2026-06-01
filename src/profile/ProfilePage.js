/* ========================================
   Profile Page - Orchestrator
   - Coordinates WeekSelector, WeekStatsRenderer, PaymentManager
   - Data loading and lifecycle
   ======================================== */

class ProfilePage {
    constructor() {
        this.officerName = null;
        this.officer = null;
        this.currentActiveWeek = null;
        this.refreshInterval = null;
        this.weeks = [];

        // Track which weeks have been paid in this session.
        // This prevents Google GViz CDN cache from reverting the paid status
        // after payment (since GViz takes time to propagate changes).
        this._paidWeeks = new Set();

        // UI references
        const loadingEl = document.getElementById('profileLoading');
        const contentEl = document.getElementById('profileContent');
        const errorEl = document.getElementById('profileError');

        // Initialize sub-components
        this.weekStats = new WeekStatsRenderer(document.getElementById('weekData'));
        this.weekSelector = new WeekSelector(document.getElementById('weekSelector'));
        this.paymentManager = new PaymentManager(this.weekSelector, {
            officerName: this.officerName
        });

        // Expose references for UI updates
        this.ui = { loading: loadingEl, content: contentEl, error: errorEl };

        // Wire up payment complete callback to refresh stats panel
        this.paymentManager.onPaymentComplete = (paidWeeks) => this._onPaymentCompleted(paidWeeks);
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        const name = urlParams.get('name');

        if (name) {
            this.officerName = decodeURIComponent(name);
            this.paymentManager.officerName = this.officerName;
            await this.loadProfileData();
            this.startAutoRefresh();
        } else {
            this.showError();
        }
    }

    destroy() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.currentActiveWeek = null;
    }

    async loadProfileData() {
        try {
            const [weeks, officers] = await Promise.all([
                ApiService.getWeeks(),
                ApiService.getOfficers()
            ]);

            this.weeks = weeks;
            this.officer = officers.find(o => this._isNameMatch(o));
            if (!this.officer) {
                this.showError();
                return;
            }

            this.renderProfile(this.officer, weeks);
        } catch (error) {
            console.error('Error loading profile:', error);
            this.showError();
        }
    }

    renderProfile(officer, weeks) {
        if (this.ui.loading) this.ui.loading.style.display = 'none';
        if (this.ui.content) {
            this.ui.content.style.display = 'block';
            this.ui.content.classList.add('fade-in');
        }

        document.getElementById('profileName').textContent = officer.name;
        document.getElementById('profileDept').textContent = officer.rank || 'ไม่ระบุหน่วยงาน';

        // Setup week selector
        this.weekSelector.onWeekSelect((week) => this.selectWeek(week));
        this.weekSelector.setPaymentManager(this.paymentManager);
        this.weekSelector.render(weeks, weeks[0]);

        // Select first week by default
        if (weeks.length > 0 && !this.currentActiveWeek) {
            this.selectWeek(weeks[0]);
        }

        // Check all weeks' payment status in background
        // Pass _paidWeeks so already-paid weeks skip server fetch (avoid GViz stale data)
        this.weekSelector.checkAllStatus(weeks, this.officerName, this._paidWeeks);
    }

    async selectWeek(weekName, isBackgroundRefresh = false) {
        this.currentActiveWeek = weekName;
        try {
            const weekData = await ApiService.getWeekData(weekName);

            // Force isPaid to true if this week was already paid in this session.
            // This prevents Google GViz CDN cache from reverting the status.
            if (weekData && this._paidWeeks.has(weekName)) {
                const searchName = this.officerName.toLowerCase();
                for (const key of Object.keys(weekData)) {
                    if (key.toLowerCase().includes(searchName) || searchName.includes(key.toLowerCase())) {
                        weekData[key].paid = 'จ่ายแล้ว';
                        break;
                    }
                }
            }

            const result = this.weekStats.render(weekData, weekName, this.officerName);

            // Update button style based on payment status from render result
            if (result) {
                this.weekSelector.updateButtonStyle(weekName, result.isPaid, result.amount);
            }
        } catch (error) {
            console.error('Error loading week data:', error);
            this.weekStats.showError();
        }
    }

    startAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(async () => {
            if (this.currentActiveWeek) {
                // Clear cache for fresh data
                ApiService.clearCache('officers');
                ApiService.clearCache('week:');  // Fix: use colon to match actual cache key format 'week:WeekName'
                ApiService.clearCache('week_');   // Keep for backward compatibility
                await this.selectWeek(this.currentActiveWeek, true);
            }
        }, 60000);
    }

    showError() {
        if (this.ui.loading) this.ui.loading.style.display = 'none';
        if (this.ui.error) this.ui.error.style.display = 'block';
    }

    /**
     * Called after payment completes.
     *
     * Instead of reloading the page (which causes Google Sheets propagation delay
     * to revert the optimistic update), we simply refresh the currently active
     * week's stats panel. The button styles and client cache have already been
     * updated optimistically in PaymentManager.handleBatchPayment().
     *
     * We also track paid weeks in _paidWeeks so that any subsequent re-fetch
     * (e.g. clicking the week button again, or auto-refresh) will override the
     * paid status to "จ่ายแล้ว" — preventing Google GViz CDN cache from
     * reverting the UI back to "unpaid" state.
     */
    async _onPaymentCompleted(paidWeeks = []) {
        // Track these weeks as paid in this session
        paidWeeks.forEach(w => this._paidWeeks.add(w));

        // Refresh the active week stats panel
        if (this.currentActiveWeek && this.officerName) {
            try {
                // Force paid status for the active week in the data
                const weekData = await ApiService.getWeekData(this.currentActiveWeek);
                if (weekData && this._paidWeeks.has(this.currentActiveWeek)) {
                    const searchName = this.officerName.toLowerCase();
                    for (const key of Object.keys(weekData)) {
                        if (key.toLowerCase().includes(searchName) || searchName.includes(key.toLowerCase())) {
                            weekData[key].paid = 'จ่ายแล้ว';
                            break;
                        }
                    }
                }

                const result = this.weekStats.render(weekData, this.currentActiveWeek, this.officerName);
                if (result) {
                    this.weekSelector.updateButtonStyle(this.currentActiveWeek, true, result.amount);
                }

                // Re-check all weeks' status. Since we pass _paidWeeks as the override set,
                // paid weeks will skip server fetch entirely — staying "paid" even if
                // GViz returns stale data.
                this.weekSelector.checkAllStatus(this.weeks, this.officerName, this._paidWeeks);
            } catch (e) {
                console.warn('Payment complete: failed to refresh stats panel', e);
            }
        }
    }

    _isNameMatch(officerObj) {
        if (!officerObj) return false;
        const search = (this.officerName || '').trim().toLowerCase();
        if (!search) return false;
        const fullName = (officerObj.fullName || '').toLowerCase();
        const shortName = (officerObj.name || '').toLowerCase();
        return fullName === search || shortName === search || search.includes(shortName);
    }
}

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
    const page = new ProfilePage();
    page.init();
});
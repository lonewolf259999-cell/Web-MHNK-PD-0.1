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
        this.weekSelector.checkAllStatus(weeks, this.officerName);
    }

    async selectWeek(weekName, isBackgroundRefresh = false) {
        this.currentActiveWeek = weekName;
        try {
            const weekData = await ApiService.getWeekData(weekName);
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
     * Instead of reloading the page (which causes Google Sheets propagation delay
     * to revert the optimistic update), we simply refresh the currently active
     * week's stats panel. The button styles and client cache have already been
     * updated optimistically in PaymentManager.handleBatchPayment().
     */
    async _onPaymentCompleted(paidWeeks = []) {
        // Refresh the active week stats panel (keeps server cache warm)
        if (this.currentActiveWeek && this.officerName) {
            // Clear cache for the paid weeks to force fresh data from server
            paidWeeks.forEach(weekName => {
                ApiService.clearCache('week:' + weekName);
                ApiService.clearCache('week_' + weekName);
            });
            
            try {
                const weekData = await ApiService.getWeekData(this.currentActiveWeek);
                const result = this.weekStats.render(weekData, this.currentActiveWeek, this.officerName);
                if (result) {
                    this.weekSelector.updateButtonStyle(this.currentActiveWeek, result.isPaid, result.amount);
                }
                // Re-check all weeks' status silently (using fresh data from server)
                // This will re-apply button styles based on latest sheet data,
                // but since patchCacheWeek already marked paid weeks in client cache,
                // paid weeks will stay paid even if GViz hasn't propagated yet.
                this.weekSelector.checkAllStatus(this.weeks, this.officerName);
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
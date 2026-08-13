/* ========================================
   Profile Page - Orchestrator
   - Coordinates WeekSelector, WeekStatsRenderer, PaymentManager
   - Data loading and lifecycle
   ======================================== */

const profileLogger = window.getLogger('ProfilePage');

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

            // Load cumulative stats from all weeks in background
            this.loadCumulativeStats();
        } catch (error) {
            profileLogger.error(`Error loading profile: ${error.message}`);
            this.showError();
        }
    }

    async loadCumulativeStats() {
        if (!this.weeks || this.weeks.length === 0) return;

        let totalCases = 0;
        let totalTake2 = 0;
        let totalInter = 0;

        // Load all weeks data in parallel
        const weekDataPromises = this.weeks.map(w => 
            ApiService.getWeekData(w).catch(() => null)
        );
        const allWeekData = await Promise.allSettled(weekDataPromises);

        for (const result of allWeekData) {
            if (result.status !== 'fulfilled' || !result.value) continue;
            const weekData = result.value;

            // Find this officer in the week data
            const d = HtmlUtils.findOfficerWeekData(weekData, this.officerName);
            if (d) {
                totalCases += parseInt(d.totalCases) || 0;
                totalTake2 += parseInt(d.take2) || 0;
                totalInter += parseInt(d.interrogations) || 0;
            }
        }

        // Update UI
        const statsEl = document.getElementById('profileTotalStats');
        if (statsEl) {
            document.getElementById('totalCasesAll').textContent = totalCases.toLocaleString();
            document.getElementById('totalTake2All').textContent = totalTake2.toLocaleString();
            document.getElementById('totalInterAll').textContent = totalInter.toLocaleString();
            statsEl.style.display = 'block';
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

        // Show phone in separate row with copy button (same style as payment copy)
        const phoneContainer = document.getElementById('profilePhone');
        const phoneNumberEl = document.getElementById('phoneNumber');
        const copyBtn = document.getElementById('copyPhoneBtn');
        if (officer.phone) {
            phoneNumberEl.textContent = officer.phone;
            phoneContainer.style.display = 'block';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(officer.phone).then(() => {
                    const original = copyBtn.innerHTML;
                    copyBtn.innerHTML = '✅';
                    copyBtn.style.color = '#2ecc71';
                    setTimeout(() => {
                        copyBtn.innerHTML = original;
                        copyBtn.style.color = '';
                    }, 1000);
                }).catch(() => {
                    const ta = document.createElement('textarea');
                    ta.value = officer.phone;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    const original = copyBtn.innerHTML;
                    copyBtn.innerHTML = '✅';
                    copyBtn.style.color = '#2ecc71';
                    setTimeout(() => {
                        copyBtn.innerHTML = original;
                        copyBtn.style.color = '';
                    }, 1000);
                });
            };
        } else {
            phoneContainer.style.display = 'none';
            phoneNumberEl.textContent = '';
        }

        // Populate officer stats (NamePD sheet: I=workDays, L=daysAway, M=steamKey)
        const setStat = (id, val, fallback = '-') => {
            const el = document.getElementById(id);
            if (!el) return;
            const v = (val === '' || val === undefined || val === null) ? fallback : val;
            el.textContent = String(v);
        };
        setStat('statWorkDays', officer.workDays, '0');
        setStat('statDaysAway', officer.daysAway, '0');
        setStat('statSteamKey', officer.steamKey || officer.steamId, '-');

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

    async selectWeek(weekName) {
        this.currentActiveWeek = weekName;
        try {
            const weekData = await ApiService.getWeekData(weekName);

            // Force isPaid to true if this week was already paid in this session.
            // This prevents Google GViz CDN cache from reverting the status.
            if (weekData && this._paidWeeks.has(weekName)) {
                const d = HtmlUtils.findOfficerWeekData(weekData, this.officerName);
                if (d) d.paid = 'จ่ายแล้ว';
            }

            const result = this.weekStats.render(weekData, weekName, this.officerName);

            // Update button style based on payment status from render result
            if (result) {
                this.weekSelector.updateButtonStyle(weekName, result.isPaid, result.amount);
                // Render duty roster table (Mon-Sun) for the active week
                this.weekStats.renderDuty(result.data ? result.data.duty : null, result.data ? result.data.dutyTotal : null);
            } else {
                this.weekStats.renderDuty(null, null);
            }
        } catch (error) {
            profileLogger.error(`Error loading week data: ${error.message}`);
            this.weekStats.showError();
        }
    }

    startAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(async () => {
            if (this.currentActiveWeek) {
                // Clear cache for fresh data
                ApiService.clearCache('officers');
                ApiService.clearCache('week_');
                await this.selectWeek(this.currentActiveWeek);
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
                    const d = HtmlUtils.findOfficerWeekData(weekData, this.officerName);
                    if (d) d.paid = 'จ่ายแล้ว';
                }

                const result = this.weekStats.render(weekData, this.currentActiveWeek, this.officerName);
                if (result) {
                    // ใช้ result.isPaid (สถานะจริง) แทนการบังคับ true เสมอ
                    // เพื่อไม่ให้สัปดาห์ที่ไม่ได้จ่ายในรอบนี้ถูกแสดงเป็น "จ่ายแล้ว" ผิด
                    this.weekSelector.updateButtonStyle(this.currentActiveWeek, result.isPaid, result.amount);
                }

                // Re-check all weeks' status. Since we pass _paidWeeks as the override set,
                // paid weeks will skip server fetch entirely — staying "paid" even if
                // GViz returns stale data.
                this.weekSelector.checkAllStatus(this.weeks, this.officerName, this._paidWeeks);
            } catch (e) {
                profileLogger.warn(`Payment complete: failed to refresh stats panel: ${e.message}`);
            }
        }
    }

    _isNameMatch(officerObj) {
        if (!officerObj) return false;
        // ตรวจทั้งชื่อเต็มและชื่อสั้นผ่าน helper กลางจุดเดียว
        return HtmlUtils.isOfficerMatch(officerObj.fullName, this.officerName)
            || HtmlUtils.isOfficerMatch(officerObj.name, this.officerName);
    }
}

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
    const page = new ProfilePage();
    page.init();
});
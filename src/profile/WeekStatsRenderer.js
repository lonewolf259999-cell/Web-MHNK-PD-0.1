/* ========================================
   WeekStatsRenderer - Render week data statistics
   - Display officer stats for a selected week
   - Payment status display
   ======================================== */

class WeekStatsRenderer {
    constructor(container) {
        this.container = container;
    }

    /**
     * Render week data for a specific officer
     */
    render(weekData, weekName, officerName) {
        if (!this.container) return;

        this._fadeIn();

        let data = null;
        const searchName = officerName.toLowerCase();

        if (weekData) {
            for (const key of Object.keys(weekData)) {
                if (key.toLowerCase().includes(searchName) || searchName.includes(key.toLowerCase())) {
                    data = weekData[key];
                    break;
                }
            }
        }

        if (!data) {
            this.container.innerHTML = `
                <div class="no-data-alert">
                    <span class="icon">🔍</span>
                    <p>ไม่พบข้อมูลการปฏิบัติงานในสัปดาห์นี้</p>
                </div>`;
            return null;
        }

        const take2Val = data.take2 || 0;
        const casesVal = data.weeklyCases || 0;
        const interrogationsVal = data.interrogations || 0;
        const totalCasesVal = data.totalCases || 0;
        const amountVal = (Number(data.totalAmount) || 0).toLocaleString();

        const paidStatus = String(data.paid || '').toLowerCase();
        const isPaid = ['yes', 'จ่ายแล้ว', 'true', '1'].includes(paidStatus);
        const paidStatusClass = isPaid ? 'status-paid' : 'status-unpaid';
        const paidStatusText = isPaid ? 'จ่ายเงินแล้ว' : 'ยังไม่ได้จ่าย';
        const paidIcon = isPaid ? '✅' : '⏳';

        this.container.innerHTML = `
            <div class="week-info">
                <div class="week-header">
                    <span class="week-tag">WEEKLY REPORT</span>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h4 style="font-weight: 800; color: var(--color-accent);">${HtmlUtils.escape(weekName)}</h4>
                        <span class="week-rank-badge">${HtmlUtils.escape(data.rank || '-')}</span>
                    </div>
                </div>
                <div class="week-stats">
                    <div class="stat-card-mini" style="flex: 1; min-width: 65px; padding: 10px 5px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 10px;">
                        <p style="font-size: 0.75rem; margin-bottom: 5px; opacity: 0.7;">Take 2</p>
                        <div class="stat-number" style="font-size: 1.1rem;">${take2Val}</div>
                    </div>
                    <div class="stat-card-mini" style="flex: 1; min-width: 65px; padding: 10px 5px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 10px;">
                        <p style="font-size: 0.75rem; margin-bottom: 5px; opacity: 0.7;">คดี</p>
                        <div class="stat-number" style="font-size: 1.1rem;">${casesVal}</div>
                    </div>
                    <div class="stat-card-mini highlight-blue" style="flex: 1; min-width: 65px; padding: 10px 5px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 10px;">
                        <p style="font-size: 0.75rem; margin-bottom: 5px;">คุมสอบ</p>
                        <div class="stat-number" style="font-size: 1.1rem;">${interrogationsVal}</div>
                    </div>
                    <div class="stat-card-mini highlight-blue" style="flex: 1; min-width: 65px; padding: 10px 5px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 10px;">
                        <p style="font-size: 0.75rem; margin-bottom: 5px;">รวมคดี</p>
                        <div class="stat-number" style="font-size: 1.1rem;">${totalCasesVal}</div>
                    </div>
                    <div class="stat-card-mini highlight-yellow" style="flex: 1; min-width: 65px; padding: 10px 5px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 10px;">
                        <p style="font-size: 0.75rem; margin-bottom: 5px;">เงินรายอาทิตย์</p>
                        <div class="stat-number" style="font-size: 1.1rem;">฿${amountVal}</div>
                    </div>
                </div>
                <div class="payment-status-card ${paidStatusClass}" style="${!isPaid ? 'border-color: #f77f07; background: rgba(247, 127, 7, 0.1); color: #f77f07;' : ''}">
                    <div class="status-label">สถานะการจ่ายเงิน</div>
                    <div class="status-value" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>${paidIcon}</span> <span>${paidStatusText}</span>
                    </div>
                </div>
            </div>
        `;

        return { isPaid, amount: data.totalAmount || 0 };
    }

    /**
     * Show loading state
     */
    showLoading() {
        if (!this.container) return;
        this.container.innerHTML = '<div class="loading-container"><div class="loader"></div><div class="loading-text">กำลังโหลด...</div></div>';
    }

    /**
     * Show error state
     */
    showError() {
        if (!this.container) return;
        this.container.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; padding: 20px;">ไม่สามารถโหลดข้อมูลอาทิตย์นี้</p>';
    }

    /**
     * Trigger fade-in animation
     */
    _fadeIn() {
        this.container.classList.remove('fade-in');
        void this.container.offsetWidth;
        this.container.classList.add('fade-in');
    }
}
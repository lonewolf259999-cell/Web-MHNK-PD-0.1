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

        const data = HtmlUtils.findOfficerWeekData(weekData, officerName);

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
                    <div class="stat-mini">
                        <p>Take 2</p>
                        <div class="stat-number">${take2Val}</div>
                    </div>
                    <div class="stat-mini">
                        <p>คดี</p>
                        <div class="stat-number">${casesVal}</div>
                    </div>
                    <div class="stat-mini blue">
                        <p>คุมสอบ</p>
                        <div class="stat-number">${interrogationsVal}</div>
                    </div>
                    <div class="stat-mini blue">
                        <p>รวมคดี</p>
                        <div class="stat-number">${totalCasesVal}</div>
                    </div>
                    <div class="stat-mini yellow">
                        <p>เงินรายอาทิตย์</p>
                        <div class="stat-number">฿${amountVal}</div>
                    </div>
                </div>
                <div class="payment-status-card ${paidStatusClass}">
                    <div class="status-label">สถานะการจ่ายเงิน</div>
                    <div class="status-value" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span>${paidIcon}</span> <span>${paidStatusText}</span>
                    </div>
                </div>
            </div>
        `;

        return { isPaid, amount: data.totalAmount || 0, data };
    }

    /**
     * Render duty roster table (Mon-Sun) for a week
     * @param {string[]} duty - 7 values for จันทร์..อาทิตย์
     * @param {string} dutyTotal - รวม (Column AJ)
     */
    renderDuty(duty, dutyTotal) {
        const el = document.getElementById('dutyTable');
        if (!el) return;

        if (!duty || !Array.isArray(duty) || duty.length === 0) {
            el.innerHTML = '<div class="no-data-alert">ไม่มีข้อมูลตารางเวรในสัปดาห์นี้</div>';
            return;
        }

        const days = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

        el.innerHTML = `
            <table class="duty-table">
                <thead>
                    <tr>
                        ${days.map(d => `<th>${d}</th>`).join('')}
                        <th>รวม</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        ${duty.map(v => `<td>${v ? `<span class="sched-shift">${HtmlUtils.escape(v)}</span>` : '<span class="sched-no-shift">-</span>'}</td>`).join('')}
                        <td class="duty-total">${dutyTotal ? `<span class="duty-total-chip">${HtmlUtils.escape(dutyTotal)}</span>` : '-'}</td>
                    </tr>
                </tbody>
            </table>
            <p class="sched-note">* ชั่วโมงการทำงานประจำวันของสัปดาห์นี้</p>
        `;
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
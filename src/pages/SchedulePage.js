/* ========================================
   Schedule Page Controller
   ======================================== */
class SchedulePage {
    constructor() {
        this.container = document.getElementById('scheduleContainer');
        this.config = null;
    }

    async load() {
        try {
            this.config = await ApiService.getScheduleConfig();
        } catch (e) {
            console.error('Failed to load schedule config:', e);
            this.config = null;
        }
    }

    render(officers, query = '') {
        if (!this.container) return;

        if (!officers || officers.length === 0) {
            this.container.innerHTML = this.createEmptyState();
            return;
        }

        // Filter by search query if needed
        let filtered = officers;
        if (query) {
            const q = query.toLowerCase();
            filtered = officers.filter(o =>
                o.name.toLowerCase().includes(q) ||
                (o.rank || '').toLowerCase().includes(q)
            );
        }

        this.container.innerHTML = this.createTable(filtered);
    }

    createTable(officers) {
        const days = this.config ? this.config.days : [];
        return `
            <div class="schedule-table-wrapper">
                <table class="schedule-table">
                    <thead>
                        <tr>
                            <th>เจ้าหน้าที่</th>
                            ${days.map(d => `<th>${d.label}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${officers.map(o => this.createRow(o, days)).join('')}
                    </tbody>
                </table>
            </div>
            <p class="sched-note">* ตารางแสดงเจ้าหน้าที่ตามเวรประจำสัปดาห์</p>
        `;
    }

    createRow(officer, days) {
        return `
            <tr>
                <td class="sched-name-cell">
                    <strong>${HtmlUtils.escape(officer.name)}</strong><br>
                    <small class="text-muted">${HtmlUtils.escape(officer.rank)}</small>
                </td>
                ${officer.schedule.map(val => `
                    <td>${val ? `<span class="sched-shift">${HtmlUtils.escape(val)}</span>` : '<span class="sched-no-shift">-</span>'}</td>
                `).join('')}
            </tr>
        `;
    }

    createEmptyState() {
        return `
            <div class="no-results">
                <div class="icon">📅</div>
                <h3>ไม่มีตารางเวร</h3>
                <p>ข้อมูลกำลังอัพเดท</p>
            </div>
        `;
    }

    setLoading() {
        if (this.container) {
            this.container.innerHTML = `<div class="loading-container"><div class="loader"></div><div class="loading-text">กำลังโหลด...</div></div>`;
        }
    }
}
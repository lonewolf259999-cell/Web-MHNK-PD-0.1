/* ========================================
   Sidebar Top 10 Component
   ======================================== */
class SidebarComponent {
    constructor() {
        this.container = document.getElementById('topList');
    }

    render(officers, max = 10) {
        if (!this.container) return;

        const sorted = this.sortByCases(officers).slice(0, max);

        if (sorted.length === 0) {
            this.container.innerHTML = '<div class="top-empty">ไม่มีข้อมูล</div>';
            return;
        }

        this.container.innerHTML = sorted.map((officer, index) => `
            <div class="top-item">
                <span class="top-rank">${index + 1}</span>
                <div class="top-info">
                    <div class="top-name">${HtmlUtils.escape(officer.name)}</div>
                    <div class="top-rank-label">${HtmlUtils.escape(officer.rank)}</div>
                </div>
                <span class="top-cases">${HtmlUtils.parseCases(officer.cases).toLocaleString()}</span>
            </div>
        `).join('');
    }

    sortByCases(officers) {
        return [...officers].sort((a, b) => {
            const casesA = HtmlUtils.parseCases(a.cases);
            const casesB = HtmlUtils.parseCases(b.cases);
            return casesB - casesA;
        });
    }
}
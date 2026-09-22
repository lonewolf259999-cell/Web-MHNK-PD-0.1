/* ========================================
   Roster Page Controller
   ======================================== */
class RosterPage {
    constructor() {
        this.container = document.getElementById('officerGrid');
        this.totalBadge = document.getElementById('totalBadge');
    }

    render(officers, query = '') {
        if (!this.container) return;

        const filtered = this.search(officers, query);

        if (filtered.length === 0) {
            this.container.innerHTML = this.createEmptyState();
        } else {
            this.container.innerHTML = '<div class="officer-table-header">' +
                '<span class="hdr-avatar"></span>' +
                '<span class="hdr-name">ชื่อ-นามสกุล</span>' +
                '<span class="hdr-rank">ยศ</span>' +
                '<span class="hdr-cases">เคส</span>' +
                '</div>' +
                filtered.map(officer => this.createRow(officer)).join('');
        }

        this.updateBadge(filtered.length, officers.length);
    }

    search(officers, query) {
        if (!query) return officers;
        const q = query.toLowerCase();
        return officers.filter(o => 
            o.name.toLowerCase().includes(q) ||
            o.code.toLowerCase().includes(q) ||
            (o.rank || '').toLowerCase().includes(q)
        );
    }

    createRow(officer) {
        const rankLevel = HtmlUtils.getRankLevel(officer.rank);
        const initials = HtmlUtils.getInitials(officer.name, officer.code);
        const casesCount = HtmlUtils.parseCases(officer.cases);
        const profileUrl = 'profile.html?name=' + encodeURIComponent(officer.fullName);

        return `
            <a href="${profileUrl}" class="officer-row" data-code="${HtmlUtils.escape(officer.code)}">
                <span class="row-avatar">${initials}</span>
                <span class="row-name">${HtmlUtils.escape(officer.name)}</span>
                <span class="rank-badge rank-${rankLevel}">${HtmlUtils.escape(officer.rank)}</span>
                <span class="row-cases"><strong>${casesCount.toLocaleString()}</strong></span>
            </a>
        `;
    }

    createEmptyState() {
        return `
            <div class="no-results">
                <div class="icon">🔍</div>
                <h3>ไม่พบข้อมูล</h3>
                <p>ลองค้นหาด้วยคำอื่น</p>
            </div>
        `;
    }

    setLoading() {
        if (this.container) {
            this.container.innerHTML = `
                <div class="loading-container">
                    <div class="loader"></div>
                    <div class="loading-text">กำลังโหลด...</div>
                </div>
            `;
        }
    }

    updateBadge(filtered, total) {
        if (this.totalBadge) this.totalBadge.textContent = total;
    }
}
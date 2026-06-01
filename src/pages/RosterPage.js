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
            this.container.innerHTML = filtered.map(officer => this.createCard(officer)).join('');
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

    createCard(officer) {
        const rankLevel = HtmlUtils.getRankLevel(officer.rank);
        const initials = HtmlUtils.getInitials(officer.name, officer.code);
        const casesCount = HtmlUtils.parseCases(officer.cases);
        const steamId = officer.steamId ? HtmlUtils.escape(officer.steamId) : '';
        const profileUrl = 'profile.html?name=' + encodeURIComponent(officer.fullName);

        return `
            <a href="${profileUrl}" class="officer-card" data-code="${HtmlUtils.escape(officer.code)}">
                <div class="card-top">
                    <div class="officer-avatar">${initials}</div>
                    <span class="rank-badge rank-${rankLevel}">${HtmlUtils.escape(officer.rank)}</span>
                </div>
                <h3 class="officer-name">${HtmlUtils.escape(officer.name)}</h3>
                <div class="card-footer">
                    <span class="cases-count">
                        <strong>${casesCount.toLocaleString()}</strong> เคส
                    </span>
                    ${steamId ? `<span class="steam-id">${steamId}</span>` : '<span class="steam-id"></span>'}
                </div>
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
/* ========================================
   Sidebar Top 10 Component
   - Left: TOP 10 from CaseAll (weekly)
   - Right: TOP 10 from NamePD (all-time)
   ======================================== */
class SidebarComponent {
    constructor() {
        this.containerRight = document.getElementById('topList');
        this.containerLeft = document.getElementById('topListLeft');
        this.titleLeft = document.getElementById('weekTop10Title');
        this.weekSelector = document.getElementById('weekSelector');
        this._weekNames = [];
    }

    render(officers, max = 10) {
        // Right sidebar (NamePD - all time cases)
        this.renderRight(officers, max);
    }

    /** Populate week selector dropdown with all week names (async) */
    async populateWeekSelector(weekNames) {
        this._weekNames = weekNames || [];
        if (!this.weekSelector) return;

        const realWeeks = weekNames.filter(w => w.toLowerCase() !== 'test');
        if (realWeeks.length === 0) return;

        this.weekSelector.innerHTML = realWeeks.map(w => {
            const isLatest = (w === realWeeks[realWeeks.length - 1]);
            return '<option value="' + HtmlUtils.escape(w) + '"' + (isLatest ? ' selected' : '') + '>' + HtmlUtils.escape(w) + '</option>';
        }).join('');
    }

    /** Called when user picks a different week from dropdown */
    async onWeekChange(weekName) {
        if (!weekName) return;
        this.containerLeft.innerHTML = '<div class="top-empty">กำลังโหลด...</div>';

        // Update title
        if (this.titleLeft) {
            this.titleLeft.innerHTML = '&#9733; <span>TOP 10</span> (' + HtmlUtils.escape(weekName) + ')';
        }

        try {
            const data = await ApiService.getWeekData(weekName);
            if (!data) {
                this.containerLeft.innerHTML = '<div class="top-empty">ไม่มีข้อมูล</div>';
                return;
            }

            // Convert object to array, sort by totalCases desc, take top 10
            const officers = Object.values(data);
            officers.sort((a, b) => {
                const casesA = parseFloat(a.totalCases) || 0;
                const casesB = parseFloat(b.totalCases) || 0;
                return casesB - casesA;
            });
            const top10 = officers.slice(0, 10);

            this.renderLeft({ weekName, top10 });
        } catch (err) {
            this.containerLeft.innerHTML = '<div class="top-empty">โหลดไม่สำเร็จ</div>';
        }
    }

    /** Right sidebar: TOP 10 from NamePD */
    renderRight(officers, max = 10) {
        if (!this.containerRight) return;

        const sorted = this.sortByCases(officers).slice(0, max);

        if (sorted.length === 0) {
            this.containerRight.innerHTML = '<div class="top-empty">ไม่มีข้อมูล</div>';
            return;
        }

        this.containerRight.innerHTML = sorted.map((officer, index) => `
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

    /** Left sidebar: TOP 10 from CaseAll weekly data */
    renderLeft(data) {
        if (!this.containerLeft) return;

        const weekName = data.weekName || '';
        const top10 = data.top10 || [];

        // Update title
        if (this.titleLeft) {
            this.titleLeft.innerHTML = '&#9733; <span>TOP 10</span> (' + HtmlUtils.escape(weekName) + ')';
        }

        if (top10.length === 0) {
            this.containerLeft.innerHTML = '<div class="top-empty">ไม่มีข้อมูล</div>';
            return;
        }

        this.containerLeft.innerHTML = top10.map((item, index) => `
            <div class="top-item">
                <span class="top-rank">${index + 1}</span>
                <div class="top-info">
                    <div class="top-name">${HtmlUtils.escape(item.name)}</div>
                    <div class="top-rank-label">${HtmlUtils.escape(item.rank)}</div>
                </div>
                <span class="top-cases">${(parseFloat(item.totalCases) || 0).toLocaleString()}</span>
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

/* ========================================
    Conduct Page Controller
    - Display conduct from Google Sheets
    - Same structure as RulesPage (Category + Text, no hardcoded header)
    - Users can create categories freely
    ======================================== */

const conductLogger = window.getLogger('ConductPage');

class ConductPage {
    constructor() {
        this.container = document.getElementById('conductContainer');
        this.data = null;
        this.adminMode = false;
    }

    async load() {
        try {
            this.data = await ApiService.getConduct();
        } catch (e) {
            conductLogger.error(`Failed to load conduct: ${e.message}`);
            this.data = null;
        }
    }

    render(query = '') {
        if (!this.container) return;

        if (!this.data) {
            this.container.innerHTML = `<div class="loading-container"><div class="loader"></div><div class="loading-text">กำลังโหลด...</div></div>`;
            return;
        }

        // Group conduct by category (column D = title/category) — same as rules
        const grouped = this.groupByCategory(this.data);
        let html = '';

        for (const [category, items] of Object.entries(grouped)) {
            const matchedItems = query
                ? HtmlUtils.filterByQuery(items, query, ['text', 'title'])
                : items;

            if (matchedItems.length === 0) continue;

            html += `
                <div class="rule-group" data-category="${HtmlUtils.escape(category)}">
                    <h3>${HtmlUtils.escape(category)}</h3>
                    <div class="rule-list">
                        ${matchedItems.map((item, localIdx) => this.createConductItem(item, localIdx + 1)).join('')}
                    </div>
                </div>
            `;
        }

        this.container.innerHTML = html || HtmlUtils.createEmptyState('📭', 'ไม่พบข้อปฏิบัติที่ค้นหา', 'ลองค้นหาด้วยคำอื่น');
    }

    createConductItem(item, localIndex) {
        return `
            <div class="rule-item rule-item-admin" data-id="${HtmlUtils.escape(item.id)}">
                <span class="rule-num">${localIndex}.</span>
                <span class="rule-text">${HtmlUtils.sanitize(item.text).replace(/\n/g, '<br>')}</span>
                <div class="admin-actions">
                    ${AdminActions.renderButtons('conduct', item.id)}
                </div>
            </div>
        `;
    }

    groupByCategory(items) {
        return HtmlUtils.groupByCategory(items, 'title', 'อื่นๆ');
    }
}
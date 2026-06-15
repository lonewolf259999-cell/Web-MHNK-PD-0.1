/* ========================================
    Conduct Page Controller
    - Display conduct from Google Sheets
    - Same structure as RulesPage (Category + Text, no hardcoded header)
    - Users can create categories freely
    ======================================== */

const conductLogger = window.getLogger ? window.getLogger('ConductPage') : {
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    info: (...args) => console.log(...args),
    debug: () => {}
};

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
        const q = query.toLowerCase();
        let html = '';

        for (const [category, items] of Object.entries(grouped)) {
            const matchedItems = q
                ? items.filter(r => r.text.toLowerCase().includes(q) || (r.title || '').toLowerCase().includes(q))
                : items;

            if (matchedItems.length === 0) continue;

            const categoryTitle = this.getCategoryTitle(category);

            html += `
                <div class="rule-group" data-category="${HtmlUtils.escape(category)}">
                    <h3>${HtmlUtils.escape(categoryTitle)}</h3>
                    <div class="rule-list">
                        ${matchedItems.map((item, localIdx) => this.createConductItem(item, localIdx + 1)).join('')}
                    </div>
                </div>
            `;
        }

        this.container.innerHTML = html || this.createEmptyState();
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
        const grouped = {};
        for (const item of items) {
            const cat = item.title || 'อื่นๆ'; // column D = category/title
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        }
        return grouped;
    }

    getCategoryTitle(category) {
        const titles = {
            'conduct': '⚖️ พฤติการณ์และกฎระเบียบ',
            'arrest': '📌 การจับกุม',
            'redCase': '🚨 คดีแดง',
            'curfew': '⚠️ เคอร์ฟิว',
            'illegal_items': '📦 สิ่งผิดกฎหมาย',
            'evasion': '🏃 การหลบหนี',
            'red_cases': '🔴 คดีแดง (Red Cases)'
        };
        return titles[category] || category;
    }

    createEmptyState() {
        return `
            <div class="no-results">
                <div class="icon">📭</div>
                <h3>ไม่พบข้อปฏิบัติที่ค้นหา</h3>
                <p>ลองค้นหาด้วยคำอื่น</p>
            </div>
        `;
    }
}
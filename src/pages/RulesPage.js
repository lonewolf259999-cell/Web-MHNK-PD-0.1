/* ========================================
    Rules Page Controller
    - Display rules from Google Sheets
    - Admin CRUD operations (Add/Edit/Delete)
    ======================================== */

const rulesLogger = window.getLogger ? window.getLogger('RulesPage') : {
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    info: (...args) => console.log(...args),
    debug: () => {}
};

class RulesPage {
    constructor() {
        this.container = document.getElementById('rulesContainer');
        this.rulesData = null;
        this.adminMode = false;
    }

    async load() {
        try {
            this.rulesData = await ApiService.getRules();
        } catch (e) {
            rulesLogger.error(`Failed to load rules: ${e.message}`);
            this.rulesData = null;
        }
    }

    render(query = '') {
        if (!this.container) return;

        if (!this.rulesData) {
            this.container.innerHTML = `<div class="loading-container"><div class="loader"></div><div class="loading-text">กำลังโหลด...</div></div>`;
            return;
        }

        // Group rules by category
        const grouped = this.groupByCategory(this.rulesData);
        const q = query.toLowerCase();
        let html = '';

        for (const [category, rules] of Object.entries(grouped)) {
            const matchedRules = q
                ? rules.filter(r => r.text.toLowerCase().includes(q) || r.category.toLowerCase().includes(q))
                : rules;

            if (matchedRules.length === 0) continue;

            const categoryTitle = this.getCategoryTitle(category);

            html += `
                <div class="rule-group" data-category="${HtmlUtils.escape(category)}">
                    <h3>${HtmlUtils.escape(categoryTitle)}</h3>
                    <div class="rule-list">
                        ${matchedRules.map((rule, localIdx) => this.createRuleItem(rule, localIdx + 1)).join('')}
                    </div>
                </div>
            `;
        }

        this.container.innerHTML = html || this.createEmptyState();
    }

    createRuleItem(rule, localIndex) {
        return `
            <div class="rule-item rule-item-admin" data-id="${HtmlUtils.escape(rule.id)}">
                <span class="rule-num">${localIndex}.</span>
                <span class="rule-text">${HtmlUtils.sanitize(rule.text).replace(/\n/g, '<br>')}</span>
                <div class="admin-actions">
                    ${AdminActions.renderButtons('rules', rule.id)}
                </div>
            </div>
        `;
    }

    groupByCategory(rules) {
        const grouped = {};
        for (const rule of rules) {
            const cat = rule.category || 'อื่นๆ';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(rule);
        }
        return grouped;
    }

    getCategoryTitle(category) {
        const titles = {
            'arrest': '📌 การจับกุมผู้ต้องหา / กฎงานดำ',
            'redCase': '🚨 คดีแดง (Red Case Rules)',
            'curfew': '⚠️ เคอร์ฟิว (Curfew Rules)'
        };
        return titles[category] || category;
    }

    // No attachAdminEvents needed — inline onclick in AdminActions.renderButtons handles it

    createEmptyState() {
        return `
            <div class="no-results">
                <div class="icon">📭</div>
                <h3>ไม่พบกฎที่ค้นหา</h3>
                <p>ลองค้นหาด้วยคำอื่น</p>
            </div>
        `;
    }
}
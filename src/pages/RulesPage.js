/* ========================================
   Rules Page Controller
   ======================================== */
class RulesPage {
    constructor() {
        this.container = document.getElementById('rulesContainer');
        this.rulesData = null;
    }

    async load() {
        try {
            this.rulesData = await ApiService.getRules();
        } catch (e) {
            console.error('Failed to load rules:', e);
            this.rulesData = null;
        }
    }

    render(query = '') {
        if (!this.container) return;

        if (!this.rulesData) {
            this.container.innerHTML = `<div class="loading-container"><div class="loader"></div><div class="loading-text">กำลังโหลด...</div></div>`;
            return;
        }

        const q = query.toLowerCase();
        let html = '';

        for (const [key, category] of Object.entries(this.rulesData)) {
            const matchedRules = q
                ? category.rules.filter(r => r.text.toLowerCase().includes(q))
                : category.rules;

            if (matchedRules.length === 0) continue;

            html += `
                <div class="rule-group" data-category="${HtmlUtils.escape(category.title)}">
                    <h3>${HtmlUtils.escape(category.title)}</h3>
                    <div class="rule-list">
                        ${matchedRules.map((rule, i) => `
                            <div class="rule-item" data-id="${rule.id}">
                                <span class="rule-num">${i + 1}.</span>
                                <span class="rule-text">${HtmlUtils.escape(rule.text).replace(/\n/g, '<br>')}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        this.container.innerHTML = html || this.createEmptyState();
    }

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
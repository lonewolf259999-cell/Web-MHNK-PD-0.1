/* ========================================
    Fines Page Controller
    - Display fines from Google Sheets
    - Admin CRUD operations (Add/Edit/Delete)
    - Uses AdminActions.renderButtons with inline onclick
    ======================================== */

const finesLogger = window.getLogger ? window.getLogger('FinesPage') : {
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    info: (...args) => console.log(...args),
    debug: () => {}
};

class FinesPage {
    constructor() {
        this.container = document.getElementById('finesContainer');
        this.data = null;
        this.adminMode = false;
    }

    async load() {
        try {
            this.data = await ApiService.getFines();
        } catch (e) {
            finesLogger.error(`Failed to load fines: ${e.message}`);
            this.data = null;
        }
    }

    render(query = '') {
        if (!this.container) return;

        if (!this.data) {
            this.container.innerHTML = `<div class="loading-container"><div class="loader"></div><div class="loading-text">กำลังโหลด...</div></div>`;
            return;
        }

        // Group fines by category
        const grouped = this.groupByCategory(this.data);
        const q = query.toLowerCase();
        let html = '';

        for (const [category, items] of Object.entries(grouped)) {
            const matchedItems = q
                ? items.filter(i => i.text.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
                : items;

            if (matchedItems.length === 0) continue;

            html += `
                <div class="fine-category" data-category="${HtmlUtils.escape(category)}">
                    <h3 class="fine-category-title">${HtmlUtils.escape(category)}</h3>
                    <div class="fine-list">
                        ${matchedItems.map(item => this.createFineItem(item)).join('')}
                    </div>
                </div>
            `;
        }

        this.container.innerHTML = html || this.createEmptyState();
    }

    createFineItem(item) {
        return `
            <div class="fine-item rule-item-admin" data-id="${HtmlUtils.escape(item.id)}">
                <span class="fine-text">${HtmlUtils.escape(item.text).replace(/\n/g, '<br>')}</span>
                <span class="fine-amount">${HtmlUtils.formatCurrency(item.amount)}</span>
                <span class="fine-time">${HtmlUtils.formatTime(item.time)}</span>
                <div class="admin-actions">
                    ${AdminActions.renderButtons('fines', item.id)}
                </div>
            </div>
        `;
    }

    groupByCategory(fines) {
        const grouped = {};
        for (const fine of fines) {
            const cat = fine.category || 'อื่นๆ';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(fine);
        }
        return grouped;
    }

    createEmptyState() {
        return `
            <div class="no-results">
                <div class="icon">📭</div>
                <h3>ไม่พบค่าปรับที่ค้นหา</h3>
                <p>ลองค้นหาด้วยคำอื่น</p>
            </div>
        `;
    }
}
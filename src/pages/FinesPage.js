/* ========================================
   Fines Page Controller
   ======================================== */
class FinesPage {
    constructor() {
        this.container = document.getElementById('finesContainer');
        this.data = null;
    }

    async load() {
        try {
            this.data = await ApiService.getFines();
        } catch (e) {
            console.error('Failed to load fines:', e);
            this.data = null;
        }
    }

    render(query = '') {
        if (!this.container) return;

        if (!this.data) {
            this.container.innerHTML = `<div class="loading-container"><div class="loader"></div><div class="loading-text">กำลังโหลด...</div></div>`;
            return;
        }

        const q = query.toLowerCase();
        let html = '';

        for (const [key, category] of Object.entries(this.data)) {
            const matchedItems = q
                ? category.items.filter(i => i.text.toLowerCase().includes(q))
                : category.items;

            if (matchedItems.length === 0) continue;

            html += `
                <div class="fine-category">
                    <h3 class="fine-category-title">${HtmlUtils.escape(category.title)}</h3>
                    <div class="fine-list">
                        ${matchedItems.map(item => `
                            <div class="fine-item" data-id="${item.id}">
                                <span class="fine-text">${HtmlUtils.escape(item.text).replace(/\n/g, '<br>')}</span>
                                <span class="fine-amount">${HtmlUtils.formatCurrency(item.amount)}</span>
                                <span class="fine-time">${HtmlUtils.formatTime(item.time)}</span>
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
                <h3>ไม่พบค่าปรับที่ค้นหา</h3>
                <p>ลองค้นหาด้วยคำอื่น</p>
            </div>
        `;
    }
}
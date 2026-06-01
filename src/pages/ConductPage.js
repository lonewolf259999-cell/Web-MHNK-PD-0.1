/* ========================================
   Conduct Page Controller
   ======================================== */
class ConductPage {
    constructor() {
        this.container = document.getElementById('conductContainer');
        this.data = null;
    }

    async load() {
        try {
            this.data = await ApiService.getConduct();
        } catch (e) {
            console.error('Failed to load conduct:', e);
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
        let items = this.data.items || [];

        if (q) {
            items = items.filter(item =>
                item.title.toLowerCase().includes(q) ||
                item.text.toLowerCase().includes(q)
            );
        }

        if (items.length === 0) {
            this.container.innerHTML = this.createEmptyState();
            return;
        }

        let html = `
            <div class="rule-group">
                <h3>${HtmlUtils.escape(this.data.title)}</h3>
                <div class="rule-list">
        `;

        items.forEach((item, i) => {
            const text = HtmlUtils.escape(item.text).replace(/\n/g, '<br>');
            html += `
                <div class="rule-item" data-id="${item.id}">
                    <span class="rule-num">${i + 1}.</span>
                    <span class="rule-text"><strong>${HtmlUtils.escape(item.title)}</strong><br>${text}</span>
                </div>
            `;
        });

        html += '</div></div>';
        this.container.innerHTML = html;
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
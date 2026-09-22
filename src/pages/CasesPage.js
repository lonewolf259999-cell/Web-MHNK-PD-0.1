/* ========================================
    Cases Page Controller
    - Display cases from Google Sheets
    - Support HTML description (bold, headings, etc.)
    - Embed Google Drive videos
    ======================================== */

const casesLogger = window.getLogger('CasesPage');

class CasesPage {
    constructor() {
        this.container = document.getElementById('casesContainer');
        this.casesData = null;
    }

    async load() {
        try {
            this.casesData = await ApiService.getCases();
        } catch (e) {
            casesLogger.error(`Failed to load cases: ${e.message}`);
            this.casesData = null;
        }
    }

    render(query = '') {
        if (!this.container) return;

        if (!this.casesData) {
            this.container.innerHTML = `<div class="loading-container"><div class="loader"></div><div class="loading-text">กำลังโหลด...</div></div>`;
            return;
        }

        let filtered = this.casesData;
        if (query) {
            filtered = HtmlUtils.filterByQuery(this.casesData, query, ['title', 'description']);
        }

        if (filtered.length === 0) {
            this.container.innerHTML = HtmlUtils.createEmptyState('📭', 'ไม่พบข้อมูลคดี', 'ลองค้นหาด้วยคำอื่น');
            return;
        }

        let html = '<div class="cases-list">';
        for (const c of filtered) {
            html += this.createCaseCard(c);
        }
        html += '</div>';

        this.container.innerHTML = html;
    }

    createCaseCard(c) {
        const videoHtml = c.video_url ? this.embedVideo(c.video_url) : '';
        const descHtml = c.description ? HtmlUtils.sanitize(c.description) : '';

        return `
            <div class="case-card" data-id="${HtmlUtils.escape(c.id)}">
                <div class="case-header">
                    <h3 class="case-title">${HtmlUtils.escape(c.title)}</h3>
                </div>
                ${descHtml ? `<div class="case-description">${descHtml}</div>` : ''}
                ${videoHtml ? `<div class="case-video">${videoHtml}</div>` : ''}
            </div>
        `;
    }

    /**
     * Convert Google Drive link to embed iframe
     * Supports:
     * - https://drive.google.com/file/d/FILE_ID/view
     * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
     * - Direct FILE_ID
     */
    embedVideo(url) {
        if (!url) return '';

        let fileId = '';

        // Extract FILE_ID from Google Drive URL
        const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match) {
            fileId = match[1];
        } else if (/^[a-zA-Z0-9_-]{25,}$/.test(url.trim())) {
            // Maybe it's just a raw file ID
            fileId = url.trim();
        }

        if (!fileId) {
            // Not a Google Drive link, show as regular link
            return `<a href="${HtmlUtils.escape(url)}" target="_blank" class="case-video-link">🎬 ดูคลิป</a>`;
        }

        const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
        return `
            <iframe src="${embedUrl}" 
                    class="case-video-iframe" 
                    allow="autoplay" 
                    allowfullscreen 
                    loading="lazy">
            </iframe>
        `;
    }
}
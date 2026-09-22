/* ========================================
   Navigation Component
   จัดการการนำทางและการเปลี่ยนหน้า
   ======================================== */
class NavigationComponent {
    constructor() {
        this.currentPage = 'roster';
        this.tabs = [];
        this.onPageChange = null;
    }

    /**
     * @param {Function} onPageChange - callback(pageName, query)
     */
    init(onPageChange) {
        this.tabs = document.querySelectorAll('.nav-tab');
        this.onPageChange = onPageChange;

        this.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                if (page && page !== this.currentPage) {
                    this.navigateTo(page);
                }
            });
        });
    }

    navigateTo(page) {
        // 🔀 ชั่วคราว: redirect หน้า "rules" ไปยัง Google Sites แทน
        if (page === 'rules') {
            const googleSitesUrl = 'https://sites.google.com/view/mahanakorndiwa/%E0%B8%AB%E0%B8%99%E0%B8%A7%E0%B8%A2%E0%B8%87%E0%B8%B2%E0%B8%99/%E0%B8%81%E0%B8%8F%E0%B8%95%E0%B8%B3%E0%B8%A3%E0%B8%A7%E0%B8%88';
            window.open(googleSitesUrl, '_blank');
            return; // ไม่ต้องทำ navigation ปกติ
        }

        // Update tabs
        this.tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.page === page);
        });

        // Update pages
        document.querySelectorAll('.page-content').forEach(content => {
            content.classList.toggle('active', content.id === `page-${page}`);
        });

        this.currentPage = page;

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Notify with current search query
        if (this.onPageChange) {
            const searchInput = document.getElementById('searchInput');
            const query = searchInput ? searchInput.value.trim() : '';
            this.onPageChange(page, query);
        }
    }

    getCurrentPage() {
        return this.currentPage;
    }
}
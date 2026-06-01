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
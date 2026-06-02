/* ========================================
   MHNK Police Department v2.0
   Main Application - Entry Point
   - Lazy loading for non-critical pages
   - Optimized data loading
   ======================================== */

const App = {
    officers: [],
    navigation: null,
    search: null,
    sidebar: null,
    rosterPage: null,
    rulesPage: null,
    conductPage: null,
    finesPage: null,
    schedulePage: null,
    
    /** Track which pages have been loaded already */
    _loadedPages: {},
    /** Auto-refresh interval (every 30 seconds) */
    _refreshInterval: null,
    _refreshIntervalMs: 30000, // 30 seconds auto-refresh

    /**
     * Initialize Application
     */
    async init() {
        console.log('MHNK Police Department v2.0 - Initializing...');

        // Initialize components
        this.navigation = new NavigationComponent();
        this.search = new SearchComponent();
        this.sidebar = new SidebarComponent();

        // Initialize ONLY the default page (roster) - others are lazy loaded
        this.rosterPage = new RosterPage();
        
        // Create placeholder instances for other pages (they load data lazily)
        this.rulesPage = new RulesPage();
        this.conductPage = new ConductPage();
        this.finesPage = new FinesPage();
        this.schedulePage = new SchedulePage();

        // Setup navigation with search callback
        this.navigation.init((page, query) => this.handlePageChange(page, query));
        this.search.init((query) => this.handleSearch(query));

        // Load ONLY critical data first (officers for roster + sidebar)
        await this.loadCriticalData();

        // Initial render (roster page only)
        this.renderInitial();

        // Pre-load other pages' data in the background (non-blocking)
        this.preloadOtherPages();

        // Start auto-refresh polling
        this.startAutoRefresh();

        console.log('Application initialized successfully');
    },

    /**
     * Load ONLY critical data needed for the first view
     */
    async loadCriticalData() {
        try {
            this.rosterPage.setLoading();
            this.schedulePage.setLoading();

            // Load officers (critical - needed for roster + sidebar)
            const officerResult = await ApiService.getOfficers().catch(err => {
                console.error('Failed to load officers:', err);
                this.showToast('ไม่สามารถโหลดข้อมูลเจ้าหน้าที่ได้', 'error');
                return [];
            });

            this.officers = officerResult;

            if (this.officers.length > 0) {
                console.log('Loaded', this.officers.length, 'officers');
            } else {
                console.warn('No officers loaded');
            }

            // Load schedule config in parallel (needed for schedule page)
            ApiService.getScheduleConfig().then(config => {
                if (this.schedulePage) this.schedulePage.config = config;
            }).catch(() => {});

        } catch (error) {
            console.error('Fatal error loading data:', error);
            this.showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
            this.officers = [];
        }
    },

    /**
     * Pre-load non-critical pages in the background after initial render
     */
    async preloadOtherPages() {
        // Small delay to let the critical render happen first
        await new Promise(resolve => setTimeout(resolve, 100));

        // Load static data (rules, conduct, fines) in parallel - non-blocking
        const pageLoads = [
            this.loadPageData('rules', () => this.rulesPage.load()),
            this.loadPageData('conduct', () => this.conductPage.load()),
            this.loadPageData('fines', () => this.finesPage.load())
        ];

        await Promise.allSettled(pageLoads);
        console.log('📦 Pre-loaded all static page data');
    },

    /**
     * Load data for a specific page with error handling
     */
    async loadPageData(pageName, loadFn) {
        try {
            await loadFn();
            this._loadedPages[pageName] = true;
        } catch (err) {
            console.warn(`⚠️ Failed to pre-load ${pageName} data:`, err.message);
        }
    },

    /**
     * Load page data on-demand (when user navigates to a page that hasn't been pre-loaded)
     */
    async ensurePageLoaded(pageName) {
        if (this._loadedPages[pageName]) return true;
        
        try {
            switch (pageName) {
                case 'rules':
                    await this.rulesPage.load();
                    break;
                case 'conduct':
                    await this.conductPage.load();
                    break;
                case 'fines':
                    await this.finesPage.load();
                    break;
                case 'schedule':
                    // Schedule data is already partially loaded (config) 
                    // It needs officers which we already have
                    break;
            }
            this._loadedPages[pageName] = true;
            return true;
        } catch (err) {
            console.error(`Failed to load ${pageName} data:`, err);
            return false;
        }
    },

    /**
     * Render only the initial page (roster)
     */
    renderInitial() {
        this.rosterPage.render(this.officers);
        this.sidebar.render(this.officers, 10);
        this.updateCounts();
    },

    /**
     * Handle search query
     */
    handleSearch(query) {
        const page = this.navigation.getCurrentPage();

        switch (page) {
            case 'roster':
                this.rosterPage.render(this.officers, query);
                this.updateCounts(query ? this.rosterPage.search(this.officers, query).length : this.officers.length);
                break;
            case 'conduct':
                this.conductPage.render(query);
                this.updateAdminBar('conduct');
                break;
            case 'rules':
                this.rulesPage.render(query);
                this.updateAdminBar('rules');
                break;
            case 'fines':
                this.finesPage.render(query);
                this.updateAdminBar('fines');
                break;
            case 'schedule':
                this.schedulePage.render(this.officers, query);
                break;
        }

        // Show total count
        if (!query) {
            this.updateCounts();
        }
    },

    /**
     * Update admin bar visibility based on current page and admin mode
     */
    updateAdminBar(page) {
        const adminBars = document.querySelectorAll('.admin-bar');
        adminBars.forEach(bar => {
            const barPage = bar.dataset.page;
            // Only show if admin mode is on AND this is the current page
            if (barPage === page && window.AppAdmin && window.AppAdmin.adminMode) {
                bar.classList.add('show');
            } else {
                bar.classList.remove('show');
            }
        });
    },

    /**
     * Handle page change (when user clicks tab)
     * Lazy-loads the page data if not already loaded
     */
    async handlePageChange(page, query) {
        // Ensure the page data is loaded (lazy load if needed)
        if (!this._loadedPages[page]) {
            await this.ensurePageLoaded(page);
        }
        this.handleSearch(query);
    },

    /**
     * Update search stats display
     */
    updateCounts(filteredCount) {
        const total = this.officers.length;
        const query = this.search.getQuery();
        const count = query ? filteredCount : total;
        this.search.updateCount(count !== undefined ? count : total, total);
    },

    /**
     * Start auto-refresh polling (every 30 seconds)
     */
    startAutoRefresh() {
        if (this._refreshInterval) clearInterval(this._refreshInterval);
        this._refreshInterval = setInterval(() => this.refreshData(), this._refreshIntervalMs);
        console.log(`🔄 Auto-refresh started (${this._refreshIntervalMs / 1000}s interval)`);
    },

    /**
     * Stop auto-refresh polling
     */
    stopAutoRefresh() {
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
            this._refreshInterval = null;
        }
    },

    /**
     * Refresh data from server (clear cache + fetch fresh)
     */
    async refreshData() {
        try {
            // Clear client-side cache
            ApiService.clearCache();
            
            // Fetch fresh officers data
            const freshOfficers = await ApiService.getOfficers();
            if (freshOfficers && freshOfficers.length > 0) {
                this.officers = freshOfficers;
                this.renderAll();
                console.log(`🔄 Auto-refreshed: ${freshOfficers.length} officers`);
            }
        } catch (err) {
            console.warn('⚠️ Auto-refresh failed:', err.message);
        }
    },

    /**
     * Render all pages (called after refresh)
     */
    renderAll() {
        const page = this.navigation.getCurrentPage();
        switch (page) {
            case 'roster':
                this.rosterPage.render(this.officers);
                break;
            case 'conduct':
                this.conductPage.render();
                break;
            case 'rules':
                this.rulesPage.render();
                break;
            case 'fines':
                this.finesPage.render();
                break;
            case 'schedule':
                this.schedulePage.render(this.officers);
                break;
        }
        this.sidebar.render(this.officers, 10);
        this.updateCounts();
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'error') {
        // Remove existing toast
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });

        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
};

// Export App globally (const at top level doesn't create window.App)
window.App = App;

/* ========================================
   Start Application
   ======================================== */
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

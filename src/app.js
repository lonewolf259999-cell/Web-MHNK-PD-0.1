/* ========================================
   MHNK Police Department v2.0
   Main Application - Entry Point
   - Lazy loading for non-critical pages
   - Optimized data loading
   ======================================== */

const logger = window.Logger ? window.Logger.createLogger('App') : {
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    info: (...args) => console.log(...args),
    debug: () => {}
};

const App = {
    officers: [],
    navigation: null,
    search: null,
    sidebar: null,
    rosterPage: null,
    casesPage: null,
    rulesPage: null,
    conductPage: null,
    finesPage: null,
    schedulePage: null,
    
    /** Track which pages have been loaded already */
    _loadedPages: {},
    /** Auto-refresh interval (every 60 seconds) */
    _refreshInterval: null,
    _refreshIntervalMs: 60000, // 60 seconds auto-refresh

    /**
     * Initialize Application
     */
    async init() {
        logger.info('MHNK Police Department v2.0 - Initializing...');

        // Initialize components
        this.navigation = new NavigationComponent();
        this.search = new SearchComponent();
        this.sidebar = new SidebarComponent();

        // Initialize ONLY the default page (roster) - others are lazy loaded
        this.rosterPage = new RosterPage();
        
        // Create placeholder instances for other pages (they load data lazily)
        this.casesPage = new CasesPage();
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

        // Pause auto-refresh when page is hidden to save bandwidth
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAutoRefresh();
            } else {
                this.startAutoRefresh();
            }
        });

        logger.info('Application initialized successfully');
    },

    /**
     * Load ONLY critical data needed for the first view
     */
    async loadCriticalData() {
        try {
            this.rosterPage.setLoading();

            // Load officers (critical - needed for roster + sidebar)
            const officerResult = await ApiService.getOfficers().catch(err => {
                logger.error(`Failed to load officers: ${err.message}`);
                window.Notification.show('ไม่สามารถโหลดข้อมูลเจ้าหน้าที่ได้', 'error');
                return [];
            });

            this.officers = officerResult;

            if (this.officers.length > 0) {
                logger.info(`Loaded ${this.officers.length} officers`);
            } else {
                logger.warn('No officers loaded');
            }

        } catch (error) {
            logger.error(`Fatal error loading data: ${error.message}`);
            window.Notification.show('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
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
        logger.info('Pre-loaded all static page data');
    },

    /**
     * Load data for a specific page with error handling
     */
    async loadPageData(pageName, loadFn) {
        try {
            await loadFn();
            this._loadedPages[pageName] = true;
        } catch (err) {
            logger.warn(`Failed to pre-load ${pageName} data: ${err.message}`);
        }
    },

    /**
     * Load page data on-demand (when user navigates to a page that hasn't been pre-loaded)
     */
    async ensurePageLoaded(pageName) {
        if (this._loadedPages[pageName]) return true;
        
        try {
            switch (pageName) {
                case 'cases':
                    await this.casesPage.load();
                    break;
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
                    await this.schedulePage.load();
                    break;
            }
            this._loadedPages[pageName] = true;
            return true;
        } catch (err) {
            logger.error(`Failed to load ${pageName} data: ${err.message}`);
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

        // Always update admin bar for current page
        this.updateAdminBar(page);

        switch (page) {
            case 'roster':
                this.rosterPage.render(this.officers, query);
                this.updateCounts(query ? this.rosterPage.search(this.officers, query).length : this.officers.length);
                break;
            case 'cases':
                this.casesPage.render(query);
                break;
            case 'conduct':
                this.conductPage.render(query);
                break;
            case 'rules':
                this.rulesPage.render(query);
                break;
            case 'fines':
                this.finesPage.render(query);
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
     * Start auto-refresh polling (every 60 seconds)
     */
    startAutoRefresh() {
        if (this._refreshInterval) clearInterval(this._refreshInterval);
        this._refreshInterval = setInterval(() => this.refreshData(), this._refreshIntervalMs);
        logger.info(`Auto-refresh started (${this._refreshIntervalMs / 1000}s interval)`);
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
     * Refresh data from server (fetch only officers, clear stale cache first)
     */
    async refreshData() {
        try {
            // Clear stale cache before fetching fresh data
            ApiService.clearCache('officers');

            const freshOfficers = await ApiService.getOfficers();
            if (freshOfficers && freshOfficers.length > 0) {
                this.officers = freshOfficers;
                // Only re-render roster + sidebar (data that changes frequently)
                this.rosterPage.render(this.officers);
                this.sidebar.render(this.officers, 10);
                this.updateCounts();
                logger.info(`Auto-refreshed: ${freshOfficers.length} officers`);
            }
        } catch (err) {
            logger.warn(`Auto-refresh failed: ${err.message}`);
        }
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
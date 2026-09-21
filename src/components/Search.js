/* ========================================
   Search Component
   จัดการการค้นหา
   ======================================== */
class SearchComponent {
    constructor() {
        this.input = null;
        this.clearBtn = null;
        this.resultCount = null;
        this.totalCount = null;
        this.onSearch = null;
    }

    /**
     * @param {Function} onSearch - callback(query)
     */
    init(onSearch) {
        this.input = document.getElementById('searchInput');
        this.clearBtn = document.getElementById('clearBtn');
        this.resultCount = document.getElementById('resultCount');
        this.totalCount = document.getElementById('totalCount');
        this.onSearch = onSearch;

        if (this.input) {
            this.input.addEventListener('input', () => this.handleInput());
        }
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clear());
        }
    }

    handleInput() {
        const query = this.input.value.trim();
        this.toggleClearBtn(query.length > 0);
        if (this.onSearch) this.onSearch(query);
    }

    clear() {
        this.input.value = '';
        this.toggleClearBtn(false);
        this.input.focus();
        if (this.onSearch) this.onSearch('');
    }

    toggleClearBtn(show) {
        if (this.clearBtn) {
            this.clearBtn.classList.toggle('visible', show);
        }
    }

    updateCount(found, total) {
        if (this.resultCount) this.resultCount.textContent = found;
        if (this.totalCount) this.totalCount.textContent = total;
    }

    getQuery() {
        return this.input ? this.input.value.trim() : '';
    }
}
(() => {
  const HtmlUtils = {
    /**
     * Escape HTML to prevent XSS
     */
    escape(text) {
      const div = document.createElement("div");
      div.textContent = text || "";
      return div.innerHTML;
    },
    /**
     * Format currency (th-TH locale)
     */
    formatCurrency(amount) {
      if (typeof amount === "string") return amount;
      if (amount === void 0 || amount === null) return "0";
      return Number(amount).toLocaleString("th-TH");
    },
    /**
     * Format time (minutes to string)
     */
    formatTime(minutes) {
      if (!minutes && minutes !== 0) return "-";
      if (minutes === 0) return "-";
      return minutes + " \u0E19\u0E32\u0E17\u0E35";
    },
    /**
     * Parse case value (supports "0M", "1.5M", etc.)
     */
    parseCases(value) {
      if (!value) return 0;
      if (typeof value === "number") return value;
      const str = String(value).trim();
      if (str.toUpperCase().endsWith("M")) {
        return parseFloat(str) * 1e6;
      }
      return parseInt(str) || 0;
    },
    /**
     * Get initials from officer code
     */
    getInitials(name, code) {
      if (code && code.trim() !== "") return code.trim();
      if (!name) return "?";
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) return parts[0].charAt(0);
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    },
    /**
     * Get rank level for styling
     */
    getRankLevel(rank) {
      const highRanks = ["\u0E1C\u0E39\u0E49\u0E1A\u0E31\u0E0D\u0E0A\u0E32\u0E01\u0E32\u0E23", "\u0E23\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E1A\u0E31\u0E0D\u0E0A\u0E32\u0E01\u0E32\u0E23", "\u0E1E\u0E25.\u0E15.\u0E2D.", "\u0E1E\u0E25.\u0E15.\u0E17.", "\u0E1E\u0E25.\u0E15.\u0E15."];
      const lowRanks = ["\u0E2A.\u0E15.\u0E15.", "\u0E2A.\u0E15.\u0E17.", "\u0E2A.\u0E15.\u0E2D.", "\u0E14.\u0E15.", "\u0E19.\u0E23.", "\u0E19.\u0E15."];
      const rankText = rank || "";
      if (highRanks.some((r) => rankText.includes(r))) return "high";
      if (lowRanks.some((r) => rankText.includes(r))) return "low";
      return "medium";
    }
  };
  const ApiService = {
    /** Simple in-memory cache */
    _cache: {},
    _cacheTTL: 6e4,
    // 60 seconds default
    /**
     * Get cached value or fetch fresh data
     */
    _getCached(key) {
      const entry = this._cache[key];
      if (entry && Date.now() - entry.timestamp < this._cacheTTL) {
        return entry.data;
      }
      return null;
    },
    _setCache(key, data) {
      this._cache[key] = {
        data,
        timestamp: Date.now()
      };
    },
    _clearCache(prefix) {
      if (prefix) {
        Object.keys(this._cache).forEach((key) => {
          if (key.startsWith(prefix)) delete this._cache[key];
        });
      } else {
        this._cache = {};
      }
    },
    /**
     * Generic fetch wrapper with error handling + caching
     */
    async fetch(url, cacheKey = null) {
      if (cacheKey) {
        const cached = this._getCached(cacheKey);
        if (cached) return cached;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (cacheKey) {
        this._setCache(cacheKey, data);
      }
      return data;
    },
    /**
     * Get all officers from server
     */
    async getOfficers() {
      return this.fetch("/api/officers", "officers");
    },
    /**
     * Get all week names
     */
    async getWeeks() {
      return this.fetch("/api/weeks", "weeks");
    },
    /**
     * Get week data for a specific week
     */
    async getWeekData(weekName) {
      return this.fetch(`/api/week-data?name=${encodeURIComponent(weekName)}`, `week:${weekName}`);
    },
    /**
     * Get static rules data
     */
    async getRules() {
      return this.fetch("/api/rules", "rules");
    },
    /**
     * Get static conduct data
     */
    async getConduct() {
      return this.fetch("/api/conduct", "conduct");
    },
    /**
     * Get static fines data
     */
    async getFines() {
      return this.fetch("/api/fines", "fines");
    },
    /**
     * Get schedule configuration
     */
    async getScheduleConfig() {
      return this.fetch("/api/schedule-config", "schedule-config");
    },
    /**
     * Clear specific cache (useful after mutations)
     */
    clearCache(prefix) {
      this._clearCache(prefix);
    }
  };
  class NotificationSystem {
    constructor() {
      this.container = document.createElement("div");
      this.container.id = "notification-container";
      this.container.style = `
            position: fixed; top: 20px; right: 20px; z-index: 99999;
            display: flex; flex-direction: column; gap: 10px;
        `;
      document.body.appendChild(this.container);
      this.injectStyles();
    }
    injectStyles() {
      const style = document.createElement("style");
      style.textContent = `
            .toast-notification {
                min-width: 280px; padding: 16px 20px; border-radius: 12px;
                color: white; font-family: 'Kanit', sans-serif; font-size: 0.9rem;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3); display: flex;
                align-items: center; justify-content: space-between;
                animation: toast-in 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);
            }
            .toast-success { background: rgba(46, 204, 113, 0.9); }
            .toast-error { background: rgba(231, 76, 60, 0.9); }
            .toast-warning { background: rgba(247, 127, 7, 0.9); }
            @keyframes toast-in {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .toast-fade-out {
                transform: translateX(100%); opacity: 0; transition: all 0.3s ease;
            }
        `;
      document.head.appendChild(style);
    }
    show(message, type = "success", duration = 3e3) {
      const toast = document.createElement("div");
      toast.className = `toast-notification toast-${type}`;
      const icon = type === "success" ? "\u2705" : type === "error" ? "\u274C" : "\u26A0\uFE0F";
      toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span>${icon}</span>
                <span>${message}</span>
            </div>
        `;
      this.container.appendChild(toast);
      setTimeout(() => {
        toast.classList.add("toast-fade-out");
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }
  }
  window.Notification = new NotificationSystem();
  class NavigationComponent {
    constructor() {
      this.currentPage = "roster";
      this.tabs = [];
      this.onPageChange = null;
    }
    /**
     * @param {Function} onPageChange - callback(pageName, query)
     */
    init(onPageChange) {
      this.tabs = document.querySelectorAll(".nav-tab");
      this.onPageChange = onPageChange;
      this.tabs.forEach((tab) => {
        tab.addEventListener("click", (e) => {
          const page = e.currentTarget.dataset.page;
          if (page && page !== this.currentPage) {
            this.navigateTo(page);
          }
        });
      });
    }
    navigateTo(page) {
      this.tabs.forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.page === page);
      });
      document.querySelectorAll(".page-content").forEach((content) => {
        content.classList.toggle("active", content.id === `page-${page}`);
      });
      this.currentPage = page;
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (this.onPageChange) {
        const searchInput = document.getElementById("searchInput");
        const query = searchInput ? searchInput.value.trim() : "";
        this.onPageChange(page, query);
      }
    }
    getCurrentPage() {
      return this.currentPage;
    }
  }
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
      this.input = document.getElementById("searchInput");
      this.clearBtn = document.getElementById("clearBtn");
      this.resultCount = document.getElementById("resultCount");
      this.totalCount = document.getElementById("totalCount");
      this.onSearch = onSearch;
      if (this.input) {
        this.input.addEventListener("input", () => this.handleInput());
      }
      if (this.clearBtn) {
        this.clearBtn.addEventListener("click", () => this.clear());
      }
    }
    handleInput() {
      const query = this.input.value.trim();
      this.toggleClearBtn(query.length > 0);
      if (this.onSearch) this.onSearch(query);
    }
    clear() {
      this.input.value = "";
      this.toggleClearBtn(false);
      this.input.focus();
      if (this.onSearch) this.onSearch("");
    }
    toggleClearBtn(show) {
      if (this.clearBtn) {
        this.clearBtn.classList.toggle("visible", show);
      }
    }
    updateCount(found, total) {
      if (this.resultCount) this.resultCount.textContent = found;
      if (this.totalCount) this.totalCount.textContent = total;
    }
    getQuery() {
      return this.input ? this.input.value.trim() : "";
    }
  }
  class SidebarComponent {
    constructor() {
      this.container = document.getElementById("topList");
    }
    render(officers, max = 10) {
      if (!this.container) return;
      const sorted = this.sortByCases(officers).slice(0, max);
      if (sorted.length === 0) {
        this.container.innerHTML = '<div class="top-empty">\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25</div>';
        return;
      }
      this.container.innerHTML = sorted.map((officer, index) => `
            <div class="top-item">
                <span class="top-rank">${index + 1}</span>
                <div class="top-info">
                    <div class="top-name">${HtmlUtils.escape(officer.name)}</div>
                    <div class="top-rank-label">${HtmlUtils.escape(officer.rank)}</div>
                </div>
                <span class="top-cases">${HtmlUtils.parseCases(officer.cases).toLocaleString()}</span>
            </div>
        `).join("");
    }
    sortByCases(officers) {
      return [...officers].sort((a, b) => {
        const casesA = HtmlUtils.parseCases(a.cases);
        const casesB = HtmlUtils.parseCases(b.cases);
        return casesB - casesA;
      });
    }
  }
  class RosterPage {
    constructor() {
      this.container = document.getElementById("officerGrid");
      this.totalBadge = document.getElementById("totalBadge");
    }
    render(officers, query = "") {
      if (!this.container) return;
      const filtered = this.search(officers, query);
      if (filtered.length === 0) {
        this.container.innerHTML = this.createEmptyState();
      } else {
        this.container.innerHTML = filtered.map((officer) => this.createCard(officer)).join("");
      }
      this.updateBadge(filtered.length, officers.length);
    }
    search(officers, query) {
      if (!query) return officers;
      const q = query.toLowerCase();
      return officers.filter(
        (o) => o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q) || (o.rank || "").toLowerCase().includes(q)
      );
    }
    createCard(officer) {
      const rankLevel = HtmlUtils.getRankLevel(officer.rank);
      const initials = HtmlUtils.getInitials(officer.name, officer.code);
      const casesCount = HtmlUtils.parseCases(officer.cases);
      const steamId = officer.steamId ? HtmlUtils.escape(officer.steamId) : "";
      const profileUrl = "profile.html?name=" + encodeURIComponent(officer.fullName);
      return `
            <a href="${profileUrl}" class="officer-card" data-code="${HtmlUtils.escape(officer.code)}">
                <div class="card-top">
                    <div class="officer-avatar">${initials}</div>
                    <span class="rank-badge rank-${rankLevel}">${HtmlUtils.escape(officer.rank)}</span>
                </div>
                <h3 class="officer-name">${HtmlUtils.escape(officer.name)}</h3>
                <div class="card-footer">
                    <span class="cases-count">
                        <strong>${casesCount.toLocaleString()}</strong> \u0E40\u0E04\u0E2A
                    </span>
                    ${steamId ? `<span class="steam-id">${steamId}</span>` : '<span class="steam-id"></span>'}
                </div>
            </a>
        `;
    }
    createEmptyState() {
      return `
            <div class="no-results">
                <div class="icon">\u{1F50D}</div>
                <h3>\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25</h3>
                <p>\u0E25\u0E2D\u0E07\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E14\u0E49\u0E27\u0E22\u0E04\u0E33\u0E2D\u0E37\u0E48\u0E19</p>
            </div>
        `;
    }
    setLoading() {
      if (this.container) {
        this.container.innerHTML = `
                <div class="loading-container">
                    <div class="loader"></div>
                    <div class="loading-text">\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14...</div>
                </div>
            `;
      }
    }
    updateBadge(filtered, total) {
      if (this.totalBadge) this.totalBadge.textContent = total;
    }
  }
  class RulesPage {
    constructor() {
      this.container = document.getElementById("rulesContainer");
      this.rulesData = null;
    }
    async load() {
      try {
        this.rulesData = await ApiService.getRules();
      } catch (e) {
        console.error("Failed to load rules:", e);
        this.rulesData = null;
      }
    }
    render(query = "") {
      if (!this.container) return;
      if (!this.rulesData) {
        this.container.innerHTML = `<div class="loading-container"><div class="loader"></div><div class="loading-text">\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14...</div></div>`;
        return;
      }
      const q = query.toLowerCase();
      let html = "";
      for (const [key, category] of Object.entries(this.rulesData)) {
        const matchedRules = q ? category.rules.filter((r) => r.text.toLowerCase().includes(q)) : category.rules;
        if (matchedRules.length === 0) continue;
        html += `
                <div class="rule-group" data-category="${HtmlUtils.escape(category.title)}">
                    <h3>${HtmlUtils.escape(category.title)}</h3>
                    <div class="rule-list">
                        ${matchedRules.map((rule, i) => `
                            <div class="rule-item" data-id="${rule.id}">
                                <span class="rule-num">${i + 1}.</span>
                                <span class="rule-text">${HtmlUtils.escape(rule.text).replace(/\n/g, "<br>")}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `;
      }
      this.container.innerHTML = html || this.createEmptyState();
    }
    createEmptyState() {
      return `
            <div class="no-results">
                <div class="icon">\u{1F4ED}</div>
                <h3>\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E01\u0E0E\u0E17\u0E35\u0E48\u0E04\u0E49\u0E19\u0E2B\u0E32</h3>
                <p>\u0E25\u0E2D\u0E07\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E14\u0E49\u0E27\u0E22\u0E04\u0E33\u0E2D\u0E37\u0E48\u0E19</p>
            </div>
        `;
    }
  }
  class ConductPage {
    constructor() {
      this.container = document.getElementById("conductContainer");
      this.data = null;
    }
    async load() {
      try {
        this.data = await ApiService.getConduct();
      } catch (e) {
        console.error("Failed to load conduct:", e);
        this.data = null;
      }
    }
    render(query = "") {
      if (!this.container) return;
      if (!this.data) {
        this.container.innerHTML = `<div class="loading-container"><div class="loader"></div><div class="loading-text">\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14...</div></div>`;
        return;
      }
      const q = query.toLowerCase();
      let items = this.data.items || [];
      if (q) {
        items = items.filter(
          (item) => item.title.toLowerCase().includes(q) || item.text.toLowerCase().includes(q)
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
        const text = HtmlUtils.escape(item.text).replace(/\n/g, "<br>");
        html += `
                <div class="rule-item" data-id="${item.id}">
                    <span class="rule-num">${i + 1}.</span>
                    <span class="rule-text"><strong>${HtmlUtils.escape(item.title)}</strong><br>${text}</span>
                </div>
            `;
      });
      html += "</div></div>";
      this.container.innerHTML = html;
    }
    createEmptyState() {
      return `
            <div class="no-results">
                <div class="icon">\u{1F4ED}</div>
                <h3>\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E1B\u0E0F\u0E34\u0E1A\u0E31\u0E15\u0E34\u0E17\u0E35\u0E48\u0E04\u0E49\u0E19\u0E2B\u0E32</h3>
                <p>\u0E25\u0E2D\u0E07\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E14\u0E49\u0E27\u0E22\u0E04\u0E33\u0E2D\u0E37\u0E48\u0E19</p>
            </div>
        `;
    }
  }
  class FinesPage {
    constructor() {
      this.container = document.getElementById("finesContainer");
      this.data = null;
    }
    async load() {
      try {
        this.data = await ApiService.getFines();
      } catch (e) {
        console.error("Failed to load fines:", e);
        this.data = null;
      }
    }
    render(query = "") {
      if (!this.container) return;
      if (!this.data) {
        this.container.innerHTML = `<div class="loading-container"><div class="loader"></div><div class="loading-text">\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14...</div></div>`;
        return;
      }
      const q = query.toLowerCase();
      let html = "";
      for (const [key, category] of Object.entries(this.data)) {
        const matchedItems = q ? category.items.filter((i) => i.text.toLowerCase().includes(q)) : category.items;
        if (matchedItems.length === 0) continue;
        html += `
                <div class="fine-category">
                    <h3 class="fine-category-title">${HtmlUtils.escape(category.title)}</h3>
                    <div class="fine-list">
                        ${matchedItems.map((item) => `
                            <div class="fine-item" data-id="${item.id}">
                                <span class="fine-text">${HtmlUtils.escape(item.text).replace(/\n/g, "<br>")}</span>
                                <span class="fine-amount">${HtmlUtils.formatCurrency(item.amount)}</span>
                                <span class="fine-time">${HtmlUtils.formatTime(item.time)}</span>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `;
      }
      this.container.innerHTML = html || this.createEmptyState();
    }
    createEmptyState() {
      return `
            <div class="no-results">
                <div class="icon">\u{1F4ED}</div>
                <h3>\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E04\u0E48\u0E32\u0E1B\u0E23\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E04\u0E49\u0E19\u0E2B\u0E32</h3>
                <p>\u0E25\u0E2D\u0E07\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E14\u0E49\u0E27\u0E22\u0E04\u0E33\u0E2D\u0E37\u0E48\u0E19</p>
            </div>
        `;
    }
  }
  class SchedulePage {
    constructor() {
      this.container = document.getElementById("scheduleContainer");
      this.config = null;
    }
    async load() {
      try {
        this.config = await ApiService.getScheduleConfig();
      } catch (e) {
        console.error("Failed to load schedule config:", e);
        this.config = null;
      }
    }
    render(officers, query = "") {
      if (!this.container) return;
      if (!officers || officers.length === 0) {
        this.container.innerHTML = this.createEmptyState();
        return;
      }
      let filtered = officers;
      if (query) {
        const q = query.toLowerCase();
        filtered = officers.filter(
          (o) => o.name.toLowerCase().includes(q) || (o.rank || "").toLowerCase().includes(q)
        );
      }
      this.container.innerHTML = this.createTable(filtered);
    }
    createTable(officers) {
      const days = this.config ? this.config.days : [];
      return `
            <div class="schedule-table-wrapper">
                <table class="schedule-table">
                    <thead>
                        <tr>
                            <th>\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48</th>
                            ${days.map((d) => `<th>${d.label}</th>`).join("")}
                        </tr>
                    </thead>
                    <tbody>
                        ${officers.map((o) => this.createRow(o, days)).join("")}
                    </tbody>
                </table>
            </div>
            <p class="sched-note">* \u0E15\u0E32\u0E23\u0E32\u0E07\u0E41\u0E2A\u0E14\u0E07\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E15\u0E32\u0E21\u0E40\u0E27\u0E23\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E2A\u0E31\u0E1B\u0E14\u0E32\u0E2B\u0E4C</p>
        `;
    }
    createRow(officer, days) {
      return `
            <tr>
                <td class="sched-name-cell">
                    <strong>${HtmlUtils.escape(officer.name)}</strong><br>
                    <small class="text-muted">${HtmlUtils.escape(officer.rank)}</small>
                </td>
                ${officer.schedule.map((val) => `
                    <td>${val ? `<span class="sched-shift">${HtmlUtils.escape(val)}</span>` : '<span class="sched-no-shift">-</span>'}</td>
                `).join("")}
            </tr>
        `;
    }
    createEmptyState() {
      return `
            <div class="no-results">
                <div class="icon">\u{1F4C5}</div>
                <h3>\u0E44\u0E21\u0E48\u0E21\u0E35\u0E15\u0E32\u0E23\u0E32\u0E07\u0E40\u0E27\u0E23</h3>
                <p>\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E01\u0E33\u0E25\u0E31\u0E07\u0E2D\u0E31\u0E1E\u0E40\u0E14\u0E17</p>
            </div>
        `;
    }
    setLoading() {
      if (this.container) {
        this.container.innerHTML = `<div class="loading-container"><div class="loader"></div><div class="loading-text">\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14...</div></div>`;
      }
    }
  }
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
    _refreshIntervalMs: 3e4,
    // 30 seconds auto-refresh
    /**
     * Initialize Application
     */
    async init() {
      console.log("MHNK Police Department v2.0 - Initializing...");
      this.navigation = new NavigationComponent();
      this.search = new SearchComponent();
      this.sidebar = new SidebarComponent();
      this.rosterPage = new RosterPage();
      this.rulesPage = new RulesPage();
      this.conductPage = new ConductPage();
      this.finesPage = new FinesPage();
      this.schedulePage = new SchedulePage();
      this.navigation.init((page, query) => this.handlePageChange(page, query));
      this.search.init((query) => this.handleSearch(query));
      await this.loadCriticalData();
      this.renderInitial();
      this.preloadOtherPages();
      this.startAutoRefresh();
      this.addRefreshButton();
      console.log("Application initialized successfully");
    },
    /**
     * Load ONLY critical data needed for the first view
     */
    async loadCriticalData() {
      try {
        this.rosterPage.setLoading();
        this.schedulePage.setLoading();
        const officerResult = await ApiService.getOfficers().catch((err) => {
          console.error("Failed to load officers:", err);
          this.showToast("\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E42\u0E2B\u0E25\u0E14\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E08\u0E49\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E44\u0E14\u0E49", "error");
          return [];
        });
        this.officers = officerResult;
        if (this.officers.length > 0) {
          console.log("Loaded", this.officers.length, "officers");
        } else {
          console.warn("No officers loaded");
        }
        ApiService.getScheduleConfig().then((config) => {
          if (this.schedulePage) this.schedulePage.config = config;
        }).catch(() => {
        });
      } catch (error) {
        console.error("Fatal error loading data:", error);
        this.showToast("\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E43\u0E19\u0E01\u0E32\u0E23\u0E42\u0E2B\u0E25\u0E14\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25", "error");
        this.officers = [];
      }
    },
    /**
     * Pre-load non-critical pages in the background after initial render
     */
    async preloadOtherPages() {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const pageLoads = [
        this.loadPageData("rules", () => this.rulesPage.load()),
        this.loadPageData("conduct", () => this.conductPage.load()),
        this.loadPageData("fines", () => this.finesPage.load())
      ];
      await Promise.allSettled(pageLoads);
      console.log("\u{1F4E6} Pre-loaded all static page data");
    },
    /**
     * Load data for a specific page with error handling
     */
    async loadPageData(pageName, loadFn) {
      try {
        await loadFn();
        this._loadedPages[pageName] = true;
      } catch (err) {
        console.warn(`\u26A0\uFE0F Failed to pre-load ${pageName} data:`, err.message);
      }
    },
    /**
     * Load page data on-demand (when user navigates to a page that hasn't been pre-loaded)
     */
    async ensurePageLoaded(pageName) {
      if (this._loadedPages[pageName]) return true;
      try {
        switch (pageName) {
          case "rules":
            await this.rulesPage.load();
            break;
          case "conduct":
            await this.conductPage.load();
            break;
          case "fines":
            await this.finesPage.load();
            break;
          case "schedule":
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
        case "roster":
          this.rosterPage.render(this.officers, query);
          this.updateCounts(query ? this.rosterPage.search(this.officers, query).length : this.officers.length);
          break;
        case "conduct":
          this.conductPage.render(query);
          break;
        case "rules":
          this.rulesPage.render(query);
          break;
        case "fines":
          this.finesPage.render(query);
          break;
        case "schedule":
          this.schedulePage.render(this.officers, query);
          break;
      }
      if (!query) {
        this.updateCounts();
      }
    },
    /**
     * Handle page change (when user clicks tab)
     * Lazy-loads the page data if not already loaded
     */
    async handlePageChange(page, query) {
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
      this.search.updateCount(count !== void 0 ? count : total, total);
    },
    /**
     * Start auto-refresh polling (every 30 seconds)
     */
    startAutoRefresh() {
      if (this._refreshInterval) clearInterval(this._refreshInterval);
      this._refreshInterval = setInterval(() => this.refreshData(), this._refreshIntervalMs);
      console.log(`\u{1F504} Auto-refresh started (${this._refreshIntervalMs / 1e3}s interval)`);
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
        ApiService.clearCache();
        const freshOfficers = await ApiService.getOfficers();
        if (freshOfficers && freshOfficers.length > 0) {
          this.officers = freshOfficers;
          this.renderAll();
          console.log(`\u{1F504} Auto-refreshed: ${freshOfficers.length} officers`);
        }
      } catch (err) {
        console.warn("\u26A0\uFE0F Auto-refresh failed:", err.message);
      }
    },
    /**
     * Render all pages (called after refresh)
     */
    renderAll() {
      const page = this.navigation.getCurrentPage();
      switch (page) {
        case "roster":
          this.rosterPage.render(this.officers);
          break;
        case "conduct":
          this.conductPage.render();
          break;
        case "rules":
          this.rulesPage.render();
          break;
        case "fines":
          this.finesPage.render();
          break;
        case "schedule":
          this.schedulePage.render(this.officers);
          break;
      }
      this.sidebar.render(this.officers, 10);
      this.updateCounts();
    },
    /**
     * Add refresh button to header
     */
    addRefreshButton() {
      const headerBadges = document.querySelector(".header-badges");
      if (!headerBadges) return;
      const refreshBtn = document.createElement("button");
      refreshBtn.className = "header-badge refresh-btn";
      refreshBtn.innerHTML = "&#8635; \u0E23\u0E35\u0E40\u0E1F\u0E23\u0E0A";
      refreshBtn.title = "\u0E23\u0E35\u0E40\u0E1F\u0E23\u0E0A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E32\u0E01 Google Sheets";
      refreshBtn.style.cssText = "cursor:pointer; border:1px solid rgba(255,255,255,0.3); padding:4px 8px; border-radius:4px; background:rgba(255,255,255,0.1); color:inherit; font:inherit;";
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.innerHTML = "&#8987; \u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14...";
        refreshBtn.disabled = true;
        try {
          await fetch("/api/refresh", { method: "POST" });
          ApiService.clearCache();
          const fresh = await ApiService.getOfficers();
          if (fresh) {
            this.officers = fresh;
            this.renderAll();
          }
          refreshBtn.innerHTML = "&#10003; \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08!";
          setTimeout(() => {
            refreshBtn.innerHTML = "&#8635; \u0E23\u0E35\u0E40\u0E1F\u0E23\u0E0A";
            refreshBtn.disabled = false;
          }, 2e3);
        } catch (err) {
          refreshBtn.innerHTML = "&#10007; \u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14";
          setTimeout(() => {
            refreshBtn.innerHTML = "&#8635; \u0E23\u0E35\u0E40\u0E1F\u0E23\u0E0A";
            refreshBtn.disabled = false;
          }, 2e3);
        }
      });
      headerBadges.appendChild(refreshBtn);
    },
    /**
     * Show toast notification
     */
    showToast(message, type = "error") {
      const existing = document.querySelector(".toast");
      if (existing) existing.remove();
      const toast = document.createElement("div");
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      document.body.appendChild(toast);
      requestAnimationFrame(() => {
        toast.classList.add("visible");
      });
      setTimeout(() => {
        toast.classList.remove("visible");
        setTimeout(() => toast.remove(), 300);
      }, 4e3);
    }
  };
  document.addEventListener("DOMContentLoaded", () => {
    App.init();
  });
})();
//# sourceMappingURL=bundle.js.map

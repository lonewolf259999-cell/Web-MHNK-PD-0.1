/* ========================================
   WeekSelector - UI for week selection buttons
   - Render week buttons with status colors
   - Check all weeks' payment status in parallel
   ======================================== */

const weekLogger = window.getLogger ? window.getLogger('WeekSelector') : {
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    info: (...args) => console.log(...args),
    debug: () => {}
};

class WeekSelector {
    constructor(container) {
        this.container = container;
        this._buttons = [];
        this._onSelectWeek = null; // callback: (weekName) => void
        this.paymentManager = null; // direct reference to PaymentManager
    }

    /**
     * Set callback when a week button is clicked
     */
    onWeekSelect(callback) {
        this._onSelectWeek = callback;
    }

    /**
     * Set payment manager reference for direct call when checkbox toggled
     */
    setPaymentManager(pm) {
        this.paymentManager = pm;
    }

    /**
     * Render week selector buttons
     */
    render(weeks, activeWeek) {
        if (!this.container) return;

        if (!weeks || weeks.length === 0) {
            this.container.innerHTML = '<div class="selector-header">⚠️ ไม่พบรายชื่อสัปดาห์ในระบบ</div>';
            return;
        }

        this.container.innerHTML = '';
        const btnGroup = document.createElement('div');
        btnGroup.className = 'week-selector';

        weeks.forEach((week, i) => {
            const btn = document.createElement('button');
            btn.className = 'week-btn' + (week === activeWeek ? ' active' : '');
            btn.innerHTML = `<span class="week-label">${HtmlUtils.escape(week)}</span>`;
            btn.dataset.week = week;
            btn.addEventListener('click', () => {
                this._buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.refreshAllStyles();
                if (this._onSelectWeek) this._onSelectWeek(week);
            });
            btnGroup.appendChild(btn);
            this._buttons.push(btn);
        });

        this.container.appendChild(btnGroup);

        // Create summary container (hidden by default)
        const summary = document.createElement('div');
        summary.id = 'unpaidSumContainer';
        summary.style = 'margin-top: 12px; padding: 15px; background: rgba(247, 127, 7, 0.1); border: 1px solid rgba(247, 127, 7, 0.3); border-radius: 12px; display: none;';
        this.container.appendChild(summary);
    }

    /**
     * Check payment status for all weeks in parallel
     * @param {string[]} weeks - List of week names
     * @param {string} officerName - Officer name to check
     * @param {Set<string>} [paidWeeksOverride] - Set of week names that should be forced as paid
     *        This prevents Google GViz CDN cache from reverting optimistically-updated paid status.
     */
    async checkAllStatus(weeks, officerName, paidWeeksOverride = new Set()) {
        await Promise.all(weeks.map(async (weekName) => {
            // If this week was already paid in this session, force paid status
            // without fetching from server (avoids GViz stale data)
            if (paidWeeksOverride.has(weekName)) {
                this.updateButtonStyle(weekName, true, 0);
                return;
            }

            try {
                const weekData = await ApiService.getWeekData(weekName);
                let data = null;

                if (weekData) {
                    for (const key of Object.keys(weekData)) {
                        if (this._isNameMatch(key, officerName)) {
                            data = weekData[key];
                            break;
                        }
                    }
                }

                if (data) {
                    const paidStatus = String(data.paid || '').toLowerCase();
                    const isPaid = ['yes', 'จ่ายแล้ว', 'true', '1'].includes(paidStatus);
                    const amount = data.totalAmount || 0;
                    this.updateButtonStyle(weekName, isPaid, amount);
} else {
                    // Data not found for this officer in this week - mark as "unchecked" so user knows it needs attention
                    weekLogger.warn(`No data found for ${officerName} in ${weekName}`);
                    this.updateButtonStyle(weekName, false, 0);
                }
            } catch (error) {
                weekLogger.error(`Status check error for ${weekName}: ${error.message}`);
                // On fetch failure, mark as unpaid with unknown amount so the
                // button doesn't stay in default "already paid" state
                this.updateButtonStyle(weekName, false, 0, true);
            }
        }));
    }

    /**
     * Update a single button's style and checkbox
     */
    updateButtonStyle(weekName, isPaid, amount, isError = false) {
        const btn = this._buttons.find(b => b.dataset.week === weekName);
        if (!btn) return;

        btn.dataset.isPaid = isPaid;
        btn.dataset.amount = amount;
        btn.dataset.isError = isError;

        const isActive = btn.classList.contains('active');
        const activeColor = '#f77f07';
        const alertColor = '#ff4d4d';
        const unpaidZeroColor = '#f77f07'; // orange for unpaid even with 0 amount
        const errorColor = '#888';
        const hasUnpaidBalance = !isPaid && (parseFloat(amount) || 0) > 0;
        const isUnpaidButZero = !isPaid && !hasUnpaidBalance && !isError;

        if (isActive) {
            btn.style.backgroundColor = activeColor;
            btn.style.color = '#fff';
            btn.style.borderColor = activeColor;
            btn.style.fontStyle = '';
            btn.title = '';
        } else if (isError) {
            // Failed to fetch data - show as "unknown" (grey)
            btn.style.backgroundColor = 'rgba(136, 136, 136, 0.15)';
            btn.style.color = errorColor;
            btn.style.borderColor = errorColor;
            btn.style.fontStyle = 'italic';
            btn.title = 'ไม่สามารถตรวจสอบสถานะได้ (คลิกเพื่อลองใหม่)';
        } else if (isUnpaidButZero) {
            // Unpaid but amount is 0 (e.g. empty/no data for this officer in this week)
            // Show orange indicator so it doesn't look like "already paid"
            btn.style.backgroundColor = 'rgba(247, 127, 7, 0.08)';
            btn.style.color = unpaidZeroColor;
            btn.style.borderColor = unpaidZeroColor;
            btn.style.fontStyle = '';
            btn.title = 'ยังไม่ได้จ่าย';
        } else {
            btn.style.backgroundColor = hasUnpaidBalance ? 'rgba(255, 77, 77, 0.1)' : '';
            btn.style.color = hasUnpaidBalance ? alertColor : '';
            btn.style.borderColor = hasUnpaidBalance ? alertColor : '';
            btn.style.fontStyle = '';
            btn.title = '';
        }

        // Checkbox for unpaid weeks (only when amount > 0)
        // Skip checkbox if week name is "test" (case-insensitive)
        const isTestWeek = weekName.toLowerCase() === 'test';
        let checkbox = btn.querySelector('.week-checkbox');
        if (hasUnpaidBalance && !isTestWeek) {
            if (!checkbox) {
                checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'week-checkbox';
                checkbox.style = 'margin-left: 10px; cursor: pointer; transform: scale(1.2);';
// change event fires AFTER checkbox state updates
                checkbox.addEventListener('change', () => {
                    weekLogger.debug(`Checkbox changed: ${checkbox.checked}`);
                    if (this.paymentManager) this.paymentManager.updateSummary();
                });
                // click event to stop propagation to parent button
                checkbox.addEventListener('click', (e) => e.stopPropagation());
                btn.appendChild(checkbox);
            }
        } else if (checkbox) {
            checkbox.remove();
        }
    }

    /**
     * Refresh styles of all buttons
     */
    refreshAllStyles() {
        this._buttons.forEach(btn => {
            const weekName = btn.dataset.week;
            const isPaid = btn.dataset.isPaid === 'true';
            const amount = btn.dataset.amount || 0;
            const isError = btn.dataset.isError === 'true';
            this.updateButtonStyle(weekName, isPaid, amount, isError);
        });
    }

    /**
     * Get all checked week names
     */
    getCheckedWeeks() {
        const result = [];
        this._buttons.forEach(btn => {
            const cb = btn.querySelector('.week-checkbox:checked');
            if (cb) result.push(btn.dataset.week);
        });
        return result;
    }

    /**
     * Get total amount of checked weeks
     */
    getCheckedTotal() {
        let total = 0;
        this._buttons.forEach(btn => {
            const cb = btn.querySelector('.week-checkbox:checked');
            if (cb) total += parseFloat(btn.dataset.amount || 0);
        });
        return total;
    }

    /**
     * Get button element by week name
     */
    getButton(weekName) {
        return this._buttons.find(b => b.dataset.week === weekName);
    }

    /**
     * Match officer name helper
     */
    _isNameMatch(key, officerName) {
        const search = (officerName || '').trim().toLowerCase();
        if (!search) return false;
        const fullKey = (key || '').toLowerCase();
        return fullKey === search || search.includes(fullKey) || fullKey.includes(search);
    }
}
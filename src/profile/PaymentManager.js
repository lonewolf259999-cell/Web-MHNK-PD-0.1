/* ========================================
   PaymentManager - Handle payment operations
   - Uses shared PinModal component
   - Batch payment processing
   - Total calculation + clipboard copy
   ======================================== */

class PaymentManager {
    constructor(weekSelector, uiElements) {
        this.weekSelector = weekSelector;
        this.officerName = uiElements.officerName || null;
        this.onPaymentComplete = null; // callback: () => void, called after successful payment
    }

    /**
     * Get summary container (lookup dynamic each time, created after render)
     */
    _getSummaryContainer() {
        return document.getElementById('unpaidSumContainer');
    }

    /**
     * Recalculate selected total and update summary UI
     */
    updateSummary() {
        const total = this.weekSelector.getCheckedTotal();
        const container = this._getSummaryContainer();
        if (!container) return;

        if (total > 0) {
            container.style.display = 'block';
            container.innerHTML = this._buildSummaryHTML(total);
            this._attachSummaryEvents(total);
        } else {
            container.style.display = 'none';
        }
    }

    /**
     * Build summary HTML
     */
    _buildSummaryHTML(total) {
        const checkedCount = this.weekSelector.getCheckedWeeks().length;
        return `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <button id="selectAllUnpaid" style="background: none; border: 1px solid #f77f07; color: #f77f07; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; cursor: pointer;">เลือกทั้งหมด</button>
                    <strong style="color: #f77f07; font-size: 1.1rem;">
                        ฿ ${total.toLocaleString()}
                        <span id="copyBtn" title="คัดลอก" style="cursor: pointer; margin-left: 5px; opacity: 0.8;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </span>
                    </strong>
                </div>
                <button id="payAllBtn" style="width: 100%; padding: 12px; background: #2ecc71; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: all 0.2s;">
                    ยืนยันการจ่ายเงิน ${checkedCount} รายการ
                </button>
            </div>`;
    }

    /**
     * Attach events to summary buttons
     */
    _attachSummaryEvents(total) {
        const payBtn = document.getElementById('payAllBtn');
        if (payBtn) {
            payBtn.onclick = () => this.handleBatchPayment();
        }

        const selectAllBtn = document.getElementById('selectAllUnpaid');
        if (selectAllBtn) {
            selectAllBtn.onclick = () => {
                document.querySelectorAll('.week-checkbox').forEach(cb => cb.checked = true);
                this.updateSummary();
            };
        }

        const copyBtn = document.getElementById('copyBtn');
        if (copyBtn) {
            copyBtn.onclick = () => {
                const rawValue = total.toString();
                navigator.clipboard.writeText(rawValue).then(() => {
                    const original = copyBtn.innerHTML;
                    copyBtn.innerHTML = '✅';
                    copyBtn.style.color = '#2ecc71';
                    setTimeout(() => {
                        copyBtn.innerHTML = original;
                        copyBtn.style.color = '';
                    }, 1000);
                });
            };
        }
    }

    /**
     * Show PIN modal dialog (using shared PinModal)
     * @returns {Promise<string|null>} - PIN string or null if cancelled
     */
    async requestPin() {
        return PinModal.request('กรุณาระบุรหัสผ่านเพื่อยืนยันการจ่าย');
    }

    /**
     * Handle batch payment for all checked weeks
     */
    async handleBatchPayment() {
        const checkedWeeks = this.weekSelector.getCheckedWeeks();
        if (checkedWeeks.length === 0) return;

        const pin = await this.requestPin();
        if (!pin) return;

        const payBtn = document.getElementById('payAllBtn');
        if (payBtn) {
            payBtn.disabled = true;
            payBtn.style.background = '#555';
            payBtn.innerHTML = '<span class="loader-mini"></span> กำลังประมวลผล...';
        }

        const results = { success: 0, failed: 0, errors: [] };
        const paidWeeks = []; // Track successfully paid week names

        // Process all payments in parallel
        const paymentPromises = checkedWeeks.map(async (weekName) => {
            try {
                const response = await fetch('/api/mark-paid', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        weekName: weekName,
                        officerName: this.officerName,
                        pin: pin
                    }),
                    signal: AbortSignal.timeout(10000)
                });

                const result = await response.json();
                if (result.success) {
                    results.success++;
                    paidWeeks.push(weekName);
                    this.weekSelector.updateButtonStyle(weekName, true, 0);
                    // Immediately patch client cache so clicking the week button
                    // later won't show stale "unpaid" data from cache
                    ApiService.patchCacheWeek(weekName, this.officerName, 'จ่ายแล้ว');
                } else {
                    results.failed++;
                    results.errors.push(`${weekName}: ${result.error}`);
                }
            } catch (e) {
                results.failed++;
                results.errors.push(`${weekName}: การเชื่อมต่อล้มเหลว`);
            }
        });

        await Promise.all(paymentPromises);

        if (results.failed > 0) {
            window.Notification.show(`ล้มเหลว ${results.failed} รายการ: ${results.errors[0]}`, 'error', 5000);
        } else {
            window.Notification.show(`ยืนยันการจ่ายเงินสำเร็จทั้งหมด ${results.success} รายการ`, 'success');
            // Refresh UI but skip re-fetching paid weeks from server to avoid
            // Google Sheets propagation delay reverting our optimistic update
            if (this.onPaymentComplete) {
                this.onPaymentComplete(paidWeeks);
            }
        }
        this.updateSummary();
    }
}
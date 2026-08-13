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

        const results = { success: 0, failed: 0, unknown: 0, errors: [] };
        const paidWeeks = []; // Track successfully paid week names

        // Process all payments in parallel
        const paymentPromises = checkedWeeks.map(async (weekName) => {
            // idempotency key: กันการเขียนซ้ำ + ใช้สอบถามผลจริงหลัง timeout
            const idempotencyKey = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 10000);

            try {
                let response;
                try {
                    response = await fetch('/api/mark-paid', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            weekName: weekName,
                            officerName: this.officerName,
                            pin: pin,
                            idempotencyKey: idempotencyKey
                        }),
                        signal: controller.signal
                    });
                } finally {
                    clearTimeout(timer);
                }

                let result = {};
                try {
                    result = await response.json();
                } catch (_) {
                    // body ไม่ใช่ JSON (เช่น gateway error) - ใช้จัดการตาม status แทน
                }

                if (response.ok && result.success) {
                    results.success++;
                    paidWeeks.push(weekName);
                    this.weekSelector.updateButtonStyle(weekName, true, 0);
                    // Immediately patch client cache so clicking the week button
                    // later won't show stale "unpaid" data from cache
                    ApiService.patchCacheWeek(weekName, this.officerName, 'จ่ายแล้ว');
                    return;
                }

                // server ยังประมวลผลไม่เสร็จ -> ถามสถานะจริงอีกรอบ
                if (result.processing) {
                    await this._resolveUncertainPayment(weekName, idempotencyKey, results, paidWeeks);
                    return;
                }

                // HTTP error จริง (PIN ผิด ฯลฯ)
                results.failed++;
                let reason = result.error;
                if (!reason) {
                    if (response.status === 401) reason = 'PIN ไม่ถูกต้อง';
                    else if (response.status === 400) reason = 'ข้อมูลไม่ถูกต้อง';
                    else reason = `เกิดข้อผิดพลาด (HTTP ${response.status})`;
                }
                results.errors.push(`${weekName}: ${reason}`);
            } catch (e) {
                // timeout/ถูกตัด -> ตัดสินใจไม่ได้ (server อาจเขียนสำเร็จแล้ว) ให้ถามผลจริง
                if (e.name === 'AbortError') {
                    await this._resolveUncertainPayment(weekName, idempotencyKey, results, paidWeeks);
                } else {
                    results.failed++;
                    results.errors.push(`${weekName}: การเชื่อมต่อล้มเหลว`);
                }
            }
        });

        await Promise.all(paymentPromises);

        const notice = [];
        if (results.failed > 0) notice.push(`ล้มเหลว ${results.failed} รายการ`);
        if (results.unknown > 0) notice.push(`ไม่ทราบผล ${results.unknown} รายการ (อาจสำเร็จแล้ว กรุณารีเฟรชเพื่อตรวจสอบ)`);

        if (notice.length > 0) {
            window.Notification.show(`${notice.join(' • ')}: ${results.errors[0]}`, 'error', 6000);
        } else {
            window.Notification.show(`ยืนยันการจ่ายเงินสำเร็จทั้งหมด ${results.success} รายการ`, 'success');
        }

        // Refresh UI (เฉพาะรายการที่ยืนยันสำเร็จ) แต่ไม่ต้อง re-fetch จาก server
        // เพื่อเลี่ยง Google Sheets propagation delay ที่จะย้อน optimistic update
        if (results.success > 0 && this.onPaymentComplete) {
            this.onPaymentComplete(paidWeeks);
        }
        this.updateSummary();
    }

    /**
     * เมื่อผลการจ่าย "ไม่แน่ใจ" (timeout / server ยังประมวลผล) ให้สอบถามผลจริง
     * จาก server ตาม idempotency key เพื่อไม่ให้แจ้งผลผิดพลาด
     * @returns {Promise<void>}
     */
    async _resolveUncertainPayment(weekName, idempotencyKey, results, paidWeeks) {
        const status = await this._queryPaymentStatus(idempotencyKey);

        if (status && status.success) {
            // server ยืนยันแล้วว่าสำเร็จ -> นับเป็นสำเร็จ
            results.success++;
            paidWeeks.push(weekName);
            this.weekSelector.updateButtonStyle(weekName, true, 0);
            ApiService.patchCacheWeek(weekName, this.officerName, 'จ่ายแล้ว');
        } else {
            // ยังไม่แน่ใจจริง ๆ -> นับเป็น "ไม่ทราบผล" (ไม่สรุปว่าล้มเหลว)
            results.unknown++;
            results.errors.push(`${weekName}: ไม่ทราบผลการจ่าย (อาจสำเร็จแล้ว) กรุณารีเฟรชเพื่อตรวจสอบ`);
        }
    }

    /**
     * สอบถามผลการจ่ายจริงจาก server ตาม idempotency key
     * @returns {Promise<Object|null>}
     */
    async _queryPaymentStatus(idempotencyKey) {
        try {
            const response = await fetch(
                `/api/mark-paid/status?key=${encodeURIComponent(idempotencyKey)}`,
                { signal: AbortSignal.timeout(5000) }
            );
            return await response.json();
        } catch (_) {
            return null;
        }
    }
}
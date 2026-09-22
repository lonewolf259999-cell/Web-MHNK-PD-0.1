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
     * Show confirmation dialog (similar to PinModal but without input)
     * @param {number} checkedCount - Number of items to pay
     * @param {number} total - Total amount
     * @param {string[]} weekNames - Array of week names to display with copy button
     * @returns {Promise<boolean>} - true if confirmed, false if cancelled
     */
    async requestConfirmation(checkedCount, total, weekNames = []) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'pin-modal-backdrop';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); display: flex; align-items: center;
                justify-content: center; z-index: 10000; backdrop-filter: blur(5px);
                animation: pinModalFadeIn 0.2s ease;
            `;

            // สร้างรายการสัปดาห์พร้อมปุ่ม copy
            const weekItemsHtml = weekNames.map(week => `
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 8px; background: rgba(247, 127, 7, 0.1); border: 1px solid rgba(247, 127, 7, 0.3); border-radius: 6px;">
                    <span style="color: #f77f07; font-size: 0.85rem; flex: 1;">${week}</span>
                    <button class="copy-week-btn" data-week="${week}" style="background: rgba(247, 127, 7, 0.2); border: 1px solid #f77f07; padding: 4px; border-radius: 4px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" title="คัดลอก">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f77f07" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                </div>
            `).join('');

            modal.innerHTML = `
                <div style="background: #1a1a2e; padding: 30px; border-radius: 16px; width: 380px; max-width: 90%; border: 1px solid rgba(247, 127, 7, 0.3); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 style="color: #f77f07; font-size: 1.2rem; margin: 0;">🔐 ยืนยันการดำเนินการ</h3>
                        <button id="confirmModalClose" style="background: none; border: none; color: #888; font-size: 1.5rem; cursor: pointer; padding: 0; line-height: 1;">&times;</button>
                    </div>
                    <div style="color: #94a3b8; font-size: 0.9rem; text-align: center; margin-bottom: 15px; line-height: 1.8;">
                        <span>ยืนยันการจ่ายเงิน <strong style="color: #f77f07;">${checkedCount}</strong> รายการ</span><br>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px;">
                            <span>จำนวนเงิน <strong style="color: #f77f07; font-size: 1.2rem;">฿ ${total.toLocaleString()}</strong></span>
                            <button class="copy-total-btn" data-amount="${total}" style="background: rgba(247, 127, 7, 0.2); border: 1px solid #f77f07; padding: 4px; border-radius: 4px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;" title="คัดลอกจำนวนเงิน">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f77f07" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                        </div>
                    </div>
                    ${weekItemsHtml ? `<div style="margin-bottom: 20px;">${weekItemsHtml}</div>` : ''}
                    <div style="display: flex; gap: 10px;">
                        <button id="confirmModalCancel" style="flex: 1; padding: 12px; background: #333; color: #ccc; border: none; border-radius: 8px; cursor: pointer; font-family: 'Kanit', sans-serif; font-weight: 600;">ยกเลิก</button>
                        <button id="confirmModalConfirm" style="flex: 1; padding: 12px; background: #f77f07; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-family: 'Kanit', sans-serif; font-weight: 600;">ยืนยัน</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const cleanup = (value) => {
                modal.remove();
                resolve(value);
            };

            modal.querySelector('#confirmModalConfirm').onclick = () => cleanup(true);
            modal.querySelector('#confirmModalCancel').onclick = () => cleanup(false);
            modal.querySelector('#confirmModalClose').onclick = () => cleanup(false);

            // เพิ่ม event สำหรับปุ่ม copy แต่ละสัปดาห์
            modal.querySelectorAll('.copy-week-btn').forEach(btn => {
                const originalSvg = btn.innerHTML;
                btn.onclick = () => {
                    const week = btn.dataset.week;
                    navigator.clipboard.writeText(week).then(() => {
                        btn.innerHTML = '✅';
                        btn.style.background = '#2ecc71';
                        btn.style.borderColor = '#2ecc71';
                        btn.style.padding = '4px 8px';
                        setTimeout(() => {
                            btn.innerHTML = originalSvg;
                            btn.style.background = '';
                            btn.style.borderColor = '';
                            btn.style.padding = '';
                        }, 1000);
                    });
                };
            });

            // เพิ่ม event สำหรับปุ่ม copy จำนวนเงิน
            modal.querySelectorAll('.copy-total-btn').forEach(btn => {
                const originalSvg = btn.innerHTML;
                btn.onclick = () => {
                    const amount = btn.dataset.amount;
                    navigator.clipboard.writeText(amount).then(() => {
                        btn.innerHTML = '✅';
                        btn.style.background = '#2ecc71';
                        btn.style.borderColor = '#2ecc71';
                        btn.style.padding = '4px 8px';
                        setTimeout(() => {
                            btn.innerHTML = originalSvg;
                            btn.style.background = '';
                            btn.style.borderColor = '';
                            btn.style.padding = '';
                        }, 1000);
                    });
                };
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) cleanup(false);
            });
        });
    }

    /**
     * Show PIN modal dialog (using shared PinModal)
     * ใช้รหัสจาก localStorage ถ้ามีและยังไม่หมดอายุ ไม่งั้นถามใหม่แล้วเก็บไว้
     * @returns {Promise<string|null>} - PIN string or null if cancelled
     */
    async requestPin() {
        // ใช้รหัสจาก localStorage ถ้ามีและยังไม่หมดอายุ (30 นาที)
        const storedData = localStorage.getItem('mhnk_payment_pin');
        if (storedData) {
            try {
                const { pin, timestamp } = JSON.parse(storedData);
                const ageMinutes = (Date.now() - timestamp) / 60000;
                if (ageMinutes < 30) {
                    return pin;
                }
                // หมดอายุ → ลบออก
                localStorage.removeItem('mhnk_payment_pin');
            } catch (_) {
                localStorage.removeItem('mhnk_payment_pin');
            }
        }

        const pin = await PinModal.request('กรุณาระบุรหัสผ่านเพื่อยืนยันการจ่าย');
        if (pin) {
            const data = JSON.stringify({ pin, timestamp: Date.now() });
            localStorage.setItem('mhnk_payment_pin', data);
        }
        return pin;
    }

    /**
     * Handle batch payment for all checked weeks
     */
    async handleBatchPayment() {
        const checkedWeeks = this.weekSelector.getCheckedWeeks();
        if (checkedWeeks.length === 0) return;

        const pin = await this.requestPin();
        if (!pin) return;

        // แสดงหน้าต่างยืนยันก่อนดำเนินการ
        const checkedCount = checkedWeeks.length;
        const total = this.weekSelector.getCheckedTotal();
        const confirmed = await this.requestConfirmation(checkedCount, total, checkedWeeks);
        if (!confirmed) return;

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
                    if (response.status === 401) {
                        reason = 'PIN ไม่ถูกต้อง';
                        // ล้างรหัสใน localStorage เพื่อให้ถามใหม่ครั้งต่อไป
                        localStorage.removeItem('mhnk_payment_pin');
                    }
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
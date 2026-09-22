/* ========================================
    PinModal - Shared PIN input modal
    - Single modal for all PIN verification
    - Server-side only PIN checking (client never stores PIN)
    ======================================== */

const PinModal = {
    /** Current active modal element (for cleanup) */
    _modal: null,

    /**
     * Open PIN input modal
     * @param {string} description - Custom description text
     * @returns {Promise<string|null>} - PIN string or null if cancelled
     */
    request(description = 'กรุณาระบุรหัสผ่านเพื่อยืนยันการดำเนินการ') {
        // Close any existing modal first
        this.close();

        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'pin-modal-backdrop';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); display: flex; align-items: center;
                justify-content: center; z-index: 10000; backdrop-filter: blur(5px);
                animation: pinModalFadeIn 0.2s ease;
            `;

            modal.innerHTML = `
                <div style="background: #1a1a2e; padding: 30px; border-radius: 16px; width: 350px; max-width: 90%; border: 1px solid rgba(247, 127, 7, 0.3); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 style="color: #f77f07; font-size: 1.2rem; margin: 0;">🔐 Admin PIN</h3>
                        <button id="pinModalClose" style="background: none; border: none; color: #888; font-size: 1.5rem; cursor: pointer; padding: 0; line-height: 1;">&times;</button>
                    </div>
                    <p style="color: #94a3b8; font-size: 0.85rem; text-align: center; margin-bottom: 20px;">${description}</p>
                    <input type="password" id="pinModalInput" maxlength="6" placeholder="••••••"
                        style="width: 100%; padding: 15px; background: #0a0f1e; border: 1px solid #444; color: #fff; text-align: center; font-size: 1.8rem; letter-spacing: 15px; border-radius: 10px; margin-bottom: 20px; box-sizing: border-box;">
                    <div style="display: flex; gap: 10px;">
                        <button id="pinModalCancel" style="flex: 1; padding: 12px; background: #333; color: #ccc; border: none; border-radius: 8px; cursor: pointer; font-family: 'Kanit', sans-serif; font-weight: 600;">ยกเลิก</button>
                        <button id="pinModalConfirm" style="flex: 1; padding: 12px; background: #f77f07; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-family: 'Kanit', sans-serif; font-weight: 600;">ยืนยัน</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            this._modal = modal;

            const input = modal.querySelector('#pinModalInput');
            input.focus();

            const cleanup = (value) => {
                this.close();
                resolve(value);
            };

            modal.querySelector('#pinModalConfirm').onclick = () => cleanup(input.value);
            modal.querySelector('#pinModalCancel').onclick = () => cleanup(null);
            modal.querySelector('#pinModalClose').onclick = () => cleanup(null);

            input.onkeydown = (e) => {
                if (e.key === 'Enter') cleanup(input.value);
                if (e.key === 'Escape') cleanup(null);
            };

            // Click backdrop to cancel
            modal.addEventListener('click', (e) => {
                if (e.target === modal) cleanup(null);
            });
        });
    },

    /**
     * Close the current modal
     */
    close() {
        if (this._modal) {
            this._modal.remove();
            this._modal = null;
        }
    }
};

// Inject fade-in animation
if (!document.getElementById('pinModalStyles')) {
    const style = document.createElement('style');
    style.id = 'pinModalStyles';
    style.textContent = `
        @keyframes pinModalFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}
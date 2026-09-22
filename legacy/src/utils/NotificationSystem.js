/* ========================================
   Notification System (Toast)
   ======================================== */
class NotificationSystem {
    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.style = `
            position: fixed; top: 20px; right: 20px; z-index: 99999;
            display: flex; flex-direction: column; gap: 10px;
        `;
        document.body.appendChild(this.container);
        this.injectStyles();
    }

    injectStyles() {
        const style = document.createElement('style');
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

    show(message, type = 'success', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
        
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span>${icon}</span>
                <span>${message}</span>
            </div>
        `;

        this.container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-fade-out');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// Export as a global singleton
window.Notification = new NotificationSystem();
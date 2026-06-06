/* ========================================
   Discord Auth Module (Shared)
   - Shared Discord OAuth logic for register, proctor, council pages
   - Handles URL callback parsing, user info display, disconnect
   - Single source for Discord SVG icon
   ======================================== */

const DiscordAuth = {
    /**
     * Discord SVG icon path (reusable)
     */
    SVG_PATH: 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z',

    /**
     * Get Discord SVG as HTML string with specified size
     */
    getSvgIcon(size = 24) {
        return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor"><path d="${this.SVG_PATH}"/></svg>`;
    },

    /**
     * Get Discord SVG large for login section header
     */
    getSvgIconLarge() {
        return `<svg viewBox="0 0 24 24" width="28" height="28"><path fill="currentColor" d="${this.SVG_PATH}"/></svg>`;
    },

    /**
     * Initialize Discord auth for a page
     * @param {Object} options
     * @param {string} options.loginUrl - URL for Discord login (e.g. '/auth/discord?state=proctor')
     * @param {Function} options.onAuthSuccess - callback(userData) when auth succeeds
     * @param {Function} options.onDisconnect - callback() when user disconnects
     */
    init(options) {
        const {
            loginUrl = '/auth/discord',
            onAuthSuccess = null,
            onDisconnect = null
        } = options || {};

        // DOM elements
        const discordIdInput = document.getElementById('discordId');
        const discordIdDisplay = document.getElementById('discordIdDisplay');
        const discordIdStatus = document.getElementById('discordIdStatus');
        const discordUserInfo = document.getElementById('discordUserInfo');
        const discordAvatar = document.getElementById('discordAvatar');
        const discordDisplayName = document.getElementById('discordDisplayName');
        const discordUserIdDisplay = document.getElementById('discordUserId');
        const discordDisconnectBtn = document.getElementById('discordDisconnect');
        const discordLoginBtn = document.getElementById('discordLoginBtn');
        const discordLoginSection = document.getElementById('discordLoginSection');
        const discordRequiredMsg = document.getElementById('discordRequiredMsg');
        const submitBtn = document.getElementById('submitBtn');

        // Parse URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const authStatus = urlParams.get('auth');
        const discordName = urlParams.get('discord_name');
        const discordAvatarHash = urlParams.get('discord_avatar');
        const discordUserIdParam = urlParams.get('discord_userId');

        // Set login button URL
        if (discordLoginBtn && loginUrl) {
            discordLoginBtn.href = loginUrl;
        }

        // Helper: save current state to restore on disconnect
        const initialState = {
            discordIdInput: discordIdInput ? discordIdInput.value : '',
            discordIdDisplay: discordIdDisplay ? discordIdDisplay.value : '',
            submitBtnDisabled: submitBtn ? submitBtn.disabled : true,
            discordRequiredMsgDisplay: discordRequiredMsg ? discordRequiredMsg.style.display : 'block'
        };

        // On successful auth
        if (authStatus === 'success' && discordUserIdParam) {
            if (discordIdInput) discordIdInput.value = discordUserIdParam;
            if (discordIdDisplay) discordIdDisplay.value = discordUserIdParam;

            // Update status
            if (discordIdStatus) {
                discordIdStatus.classList.add('connected');
                const statusText = discordIdStatus.querySelector('.status-text');
                if (statusText) statusText.textContent = 'เชื่อมต่อแล้ว';
            }

            if (discordName) {
                if (discordDisplayName) discordDisplayName.textContent = `@${discordName}`;
                if (discordUserIdDisplay) discordUserIdDisplay.textContent = discordUserIdParam;

                // Create avatar URL
                const avatarUrl = discordAvatarHash
                    ? `https://cdn.discordapp.com/avatars/${discordUserIdParam}/${discordAvatarHash}.png?size=64`
                    : 'https://cdn.discordapp.com/embed/avatars/0.png';
                if (discordAvatar) discordAvatar.src = avatarUrl;

                if (discordUserInfo) discordUserInfo.style.display = 'flex';
                if (discordLoginBtn) discordLoginBtn.style.display = 'none';
                if (discordLoginSection) discordLoginSection.classList.add('connected');

                // Enable submit button
                if (submitBtn) {
                    submitBtn.disabled = false;
                }
                if (discordRequiredMsg) discordRequiredMsg.style.display = 'none';
            }

            // Call page-specific callback
            if (onAuthSuccess) {
                onAuthSuccess({
                    discordId: discordUserIdParam,
                    discordName: discordName || '',
                    discordAvatarHash: discordAvatarHash || ''
                });
            }

            // Clean URL parameters
            const cleanPath = window.location.pathname;
            window.history.replaceState({}, document.title, cleanPath);
        }

        // On auth failed
        if (authStatus === 'failed') {
            const errorContainer = document.getElementById('errorContainer');
            const errorList = document.getElementById('errorList');
            if (errorList) {
                const li = document.createElement('li');
                li.textContent = 'เชื่อมต่อ Discord ล้มเหลว กรุณาลองใหม่อีกครั้ง';
                errorList.appendChild(li);
            }
            if (errorContainer) errorContainer.style.display = 'block';
            const cleanPath = window.location.pathname;
            window.history.replaceState({}, document.title, cleanPath);
        }

        // Disconnect handler
        if (discordDisconnectBtn) {
            discordDisconnectBtn.addEventListener('click', () => {
                if (discordIdInput) discordIdInput.value = '';
                if (discordIdDisplay) discordIdDisplay.value = '';
                if (discordIdStatus) {
                    discordIdStatus.classList.remove('connected');
                    const statusText = discordIdStatus.querySelector('.status-text');
                    if (statusText) statusText.textContent = 'ยังไม่ได้เชื่อมต่อ';
                }
                if (discordUserInfo) discordUserInfo.style.display = 'none';
                if (discordLoginBtn) discordLoginBtn.style.display = 'flex';
                if (discordLoginSection) discordLoginSection.classList.remove('connected');

                // Disable submit
                if (submitBtn) submitBtn.disabled = true;
                if (discordRequiredMsg) discordRequiredMsg.style.display = 'block';

                // Call page-specific disconnect callback
                if (onDisconnect) onDisconnect();
            });
        }
    }
};

// Export for use
if (typeof window !== 'undefined') {
    window.DiscordAuth = DiscordAuth;
}
/* MHNK Map - DC Auth Manager (Cyberpunk Style) */
const MHNK_DC = {
    _dcId: null,
    _dcName: null,
    _dcAvatar: null,
    _isConnected: false,
    _onStatusChange: null,

    init(onStatusChange) {
        this._onStatusChange = onStatusChange;
        this._bindEvents();
        this._checkExistingAuth();
    },

    _bindEvents() {
        var el = document.getElementById('mhnk-dc-disconnect');
        if (el) el.addEventListener('click', () => this.disconnect());
    },

    _checkExistingAuth() {
        var params = new URLSearchParams(window.location.search);
        var authStatus = params.get('auth');
        var discordName = params.get('discord_name');
        // Server may send discord_userId (snowflake) or discord_id (username#discriminator)
        var discordId = params.get('discord_userId') || params.get('discord_id');
        var discordAvatar = params.get('discord_avatar');

        // Clear URL params
        if (window.location.search) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // If auth failed
        if (authStatus === 'failed') {
            this._setDisconnected();
            return;
        }

        // If auth success
        if (authStatus === 'success' && discordId) {
            this._setConnected(discordId, discordName || '', discordAvatar || '');
            return;
        }

        // Check localStorage for saved session
        var saved = localStorage.getItem('mhnk_dc_session');
        if (saved) {
            try {
                var s = JSON.parse(saved);
                if (s.dcId) { this._setConnected(s.dcId, s.dcName || '', s.dcAvatar || ''); return; }
            } catch(e) { localStorage.removeItem('mhnk_dc_session'); }
        }

        this._setDisconnected();
    },

    _setConnected(dcId, dcName, dcAvatar) {
        this._dcId = dcId;
        this._dcName = dcName;
        this._dcAvatar = dcAvatar;
        this._isConnected = true;
        localStorage.setItem('mhnk_dc_session', JSON.stringify({dcId:dcId, dcName:dcName, dcAvatar:dcAvatar}));
        this._render();
        if (this._onStatusChange) this._onStatusChange(true, dcId, dcName);
    },

    _setDisconnected() {
        this._dcId = null;
        this._dcName = null;
        this._dcAvatar = null;
        this._isConnected = false;
        this._render();
        if (this._onStatusChange) this._onStatusChange(false, null, null);
    },

    _render() {
        var btn = document.getElementById('mhnk-dc-btn');
        var info = document.getElementById('mhnk-dc-info');
        var avatar = document.getElementById('mhnk-dc-avatar');
        var name = document.getElementById('mhnk-dc-name');
        var idEl = document.getElementById('mhnk-dc-id');

        if (this._isConnected) {
            if (btn) btn.style.display = 'none';
            if (info) info.style.display = 'flex';
            if (name) name.textContent = '@' + (this._dcName || 'Unknown');
            if (idEl) idEl.textContent = 'ID: ' + (this._dcId || '-');
            if (avatar) {
                var url = this._dcAvatar
                    ? 'https://cdn.discordapp.com/avatars/' + this._dcId + '/' + this._dcAvatar + '.png?size=64'
                    : 'https://cdn.discordapp.com/embed/avatars/0.png';
                avatar.src = url;
            }
        } else {
            if (btn) btn.style.display = 'flex';
            if (info) info.style.display = 'none';
        }
    },

    disconnect() {
        localStorage.removeItem('mhnk_dc_session');
        this._setDisconnected();
    },

    getDcId() { return this._dcId; },
    getDcName() { return this._dcName; },
    isConnected() { return this._isConnected; },

    canEdit(poiDcId) {
        if (!this._isConnected || !this._dcId) return false;
        if (!poiDcId) return true;
        return String(this._dcId).trim() === String(poiDcId).trim();
    }
};

if (typeof window !== 'undefined') { window.MHNK_DC = MHNK_DC; }
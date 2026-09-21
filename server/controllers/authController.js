/* ========================================
   Controller - Discord Auth endpoints
   ======================================== */

const discordAuth = require('../services/discordAuth');
const { createLogger } = require('../utils/logger');
const trace = require('../debug/trace');
const config = require('../config');

const logger = createLogger('AuthController');

/**
 * Redirect ไป Discord OAuth2 Login
 */
function discordLogin(req, res) {
    const state = req.query.state || '';
    const redirectTo = req.query.redirect || getFallbackPage(state);

    trace.add({ step: 'login_start', state, redirect_uri: config.APP_URL ? `${config.APP_URL}/auth/discord/callback` : null });

    try {
        const authUrl = discordAuth.getAuthUrl(state);
        res.redirect(authUrl);
    } catch (err) {
        // ถ้า Discord OAuth ไม่ได้ configure ให้ redirect กลับพร้อม error message
        logger.error(`Discord login error: ${err.message}`);
        trace.add({ step: 'login_error', error: err.message });
        res.redirect(`${redirectTo}?auth=failed&error=discord_not_configured`);
    }
}

/**
 * Get fallback page URL based on state parameter
 */
function getFallbackPage(state) {
    if (state === 'medical') return '/medical.html';
    if (state === 'admin') return '/proctor.html';
    if (state === 'roster') return '/rostermanage.html';
    if (state && state.startsWith('map')) return '/MapMhnkPD';
    return '/register.html';
}

/**
 * จัดการ Callback จาก Discord
 */
async function discordCallback(req, res) {
    try {
        const { code, error, state } = req.query;

        const fallbackPage = getFallbackPage(state);

        trace.add({ step: 'callback_received', state, has_code: !!code, error: error || null });

        if (error || !code) {
            trace.add({ step: 'redirect', target: fallbackPage, outcome: 'failed', reason: 'no_code_or_error' });
            return res.redirect(`${fallbackPage}?auth=failed`);
        }

        // แลก code เป็น access token
        const accessToken = await discordAuth.exchangeCode(code);
        trace.add({ step: 'token_obtained' });

        // ดึงข้อมูล user
        const userInfo = await discordAuth.getUserInfo(accessToken);

        // สร้าง Discord ID string
        const discordId = userInfo.discriminator && userInfo.discriminator !== '0'
            ? `${userInfo.username}#${userInfo.discriminator}`
            : userInfo.username;

        // สร้าง URL parameters
        const params = new URLSearchParams({
            discord_id: discordId,
            discord_userId: userInfo.id,
            discord_name: userInfo.displayName,
            discord_avatar: userInfo.avatar || '',
            auth: 'success'
        });

        // ตรวจสอบ state เพื่อ redirect กลับไปหน้าที่ถูกต้อง
        trace.add({ step: 'redirect', target: fallbackPage, outcome: 'success' });
        res.redirect(`${fallbackPage}?${params.toString()}`);

    } catch (err) {
        logger.error(`Discord auth error: ${err.message}`);
        trace.add({ step: 'callback_error', error: err.message, discord_status: err.discordStatus, discord_error: err.discordError, discord_raw: err.discordRaw });
        const redirectTo = getFallbackPage(req.query.state);
        trace.add({ step: 'redirect', target: redirectTo, outcome: 'failed', reason: 'exception' });
        res.redirect(`${redirectTo}?auth=failed`);
    }
}

module.exports = {
    discordLogin,
    discordCallback
};
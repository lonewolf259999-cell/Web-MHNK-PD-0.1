/* ========================================
   Controller - Discord Auth endpoints
   ======================================== */

const discordAuth = require('../services/discordAuth');
const { createLogger } = require('../utils/logger');

const logger = createLogger('AuthController');

/**
 * Redirect ไป Discord OAuth2 Login
 */
function discordLogin(req, res) {
    const state = req.query.state || '';
    const redirectTo = req.query.redirect || getFallbackPage(state);

    try {
        const authUrl = discordAuth.getAuthUrl(state);
        res.redirect(authUrl);
    } catch (err) {
        logger.error(`Discord login error: ${err.message}`);
        if (!res.headersSent) {
            return res.redirect(`${redirectTo}?auth=failed&error=discord_not_configured`);
        }
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
async function discordCallback(req, res, next) {
    try {
        const { code, error, state } = req.query;

        const fallbackPage = getFallbackPage(state);
        
        if (error || !code) {
            return res.redirect(`${fallbackPage}?auth=failed`);
        }

        // แลก code เป็น access token
        const accessToken = await discordAuth.exchangeCode(code);
        
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
        res.redirect(`${fallbackPage}?${params.toString()}`);

    } catch (err) {
        logger.error(`Discord auth error: ${err.message}`, { error_code: err.code });
        const redirectTo = getFallbackPage(req.query.state);
        if (!res.headersSent) {
            return res.redirect(`${redirectTo}?auth=failed&error=${encodeURIComponent(err.message)}`);
        }
        next(err);
    }
}

module.exports = {
    discordLogin,
    discordCallback
};
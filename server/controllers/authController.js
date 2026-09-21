/* ========================================
   Controller - Discord Auth endpoints
   ======================================== */

const discordAuth = require('../services/discordAuth');
const { createLogger } = require('../utils/logger');
const config = require('../config');

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

        // ใช้ proxy ถ้ามีการกำหนดค่า (สำหรับ Inwcloud ที่ใช้ IP ร่วมกัน)
        let discordId, discordUserId, discordName, discordAvatar;

        if (config.DISCORD_PROXY_URL) {
            const response = await fetch(config.DISCORD_PROXY_URL + '/api/discord/exchange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, state })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Discord proxy failed');
            }
            const data = await response.json();
            discordId = data.discord_id;
            discordUserId = data.discord_userId;
            discordName = data.discord_name;
            discordAvatar = data.discord_avatar || '';
        } else {
            // แลก code เป็น access token
            const accessToken = await discordAuth.exchangeCode(code);

            // ดึงข้อมูล user
            const userInfo = await discordAuth.getUserInfo(accessToken);

            // สร้าง Discord ID string
            discordId = userInfo.discriminator && userInfo.discriminator !== '0'
                ? `${userInfo.username}#${userInfo.discriminator}`
                : userInfo.username;
            discordUserId = userInfo.id;
            discordName = userInfo.displayName;
            discordAvatar = userInfo.avatar || '';
        }

        // สร้าง URL parameters
        const params = new URLSearchParams({
            discord_id: discordId,
            discord_userId: discordUserId,
            discord_name: discordName,
            discord_avatar: discordAvatar,
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

/**
 * Exchange code for token + user info (for proxy use by Inwcloud)
 * This endpoint allows another server (e.g., Inwcloud) to delegate
 * the Discord token exchange to Render, avoiding shared-IP rate limits.
 */
async function discordExchange(req, res) {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Authorization code is required' });
    }

    try {
        logger.debug('Discord token exchange requested (proxy mode)');

        const accessToken = await discordAuth.exchangeCode(code);
        const userInfo = await discordAuth.getUserInfo(accessToken);

        const discordId = userInfo.discriminator && userInfo.discriminator !== '0'
            ? `${userInfo.username}#${userInfo.discriminator}`
            : userInfo.username;

        logger.debug(`Discord exchange successful for user: ${discordId}`);
        res.json({
            discord_id: discordId,
            discord_userId: userInfo.id,
            discord_name: userInfo.displayName,
            discord_avatar: userInfo.avatar || ''
        });
    } catch (err) {
        logger.error(`Discord exchange error: ${err.message}`, { error_code: err.code });
        res.status(502).json({ error: err.message });
    }
}

module.exports = {
    discordLogin,
    discordCallback,
    discordExchange
};
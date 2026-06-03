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
    const authUrl = discordAuth.getAuthUrl(state);
    res.redirect(authUrl);
}

/**
 * จัดการ Callback จาก Discord
 */
async function discordCallback(req, res) {
    try {
        const { code, error, state } = req.query;

        if (error || !code) {
            const redirectTo = state === 'proctor' ? '/proctor' : '/register';
            return res.redirect(`${redirectTo}?auth=failed`);
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
        const redirectTo = state === 'proctor' ? '/proctor' : '/register';
        res.redirect(`${redirectTo}?${params.toString()}`);

    } catch (err) {
        logger.error(`Discord auth error: ${err.message}`);
        const redirectTo = req.query.state === 'proctor' ? '/proctor' : '/register';
        res.redirect(`${redirectTo}?auth=failed`);
    }
}

module.exports = {
    discordLogin,
    discordCallback
};
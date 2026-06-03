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
    const authUrl = discordAuth.getAuthUrl();
    res.redirect(authUrl);
}

/**
 * จัดการ Callback จาก Discord
 */
async function discordCallback(req, res) {
    try {
        const { code, error } = req.query;

        if (error || !code) {
            return res.redirect('/register?auth=failed');
        }

        // แลก code เป็น access token
        const accessToken = await discordAuth.exchangeCode(code);
        
        // ดึงข้อมูล user
        const userInfo = await discordAuth.getUserInfo(accessToken);

        // สร้าง Discord ID string
        const discordId = userInfo.discriminator && userInfo.discriminator !== '0' 
            ? `${userInfo.username}#${userInfo.discriminator}`
            : userInfo.username;

        // Redirect กลับไปหน้า register พร้อมข้อมูล
        const params = new URLSearchParams({
            discord_id: discordId,
            discord_userId: userInfo.id,
            discord_name: userInfo.displayName,
            discord_avatar: userInfo.avatar || '',
            auth: 'success'
        });

        res.redirect(`/register?${params.toString()}`);

} catch (err) {
        logger.error(`Discord auth error: ${err.message}`);
        res.redirect('/register?auth=failed');
    }
}

module.exports = {
    discordLogin,
    discordCallback
};
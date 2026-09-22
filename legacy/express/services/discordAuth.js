/* ========================================
   Discord OAuth2 Service
   - จัดการ Discord Login
   ======================================== */

const https = require('https');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('DiscordAuth');
const REDIRECT_URI = `${config.APP_URL}/auth/discord/callback`;

logger.info(`Config loaded - APP_URL: ${config.APP_URL}, REDIRECT_URI: ${REDIRECT_URI}`);

/**
 * สร้าง URL สำหรับ Discord OAuth2 Login
 * @param {string} state - ระบุหน้าที่เรียก (เช่น 'register' หรือ 'council')
 */
function getAuthUrl(state = '') {
    // ตรวจสอบว่ามี Discord credentials หรือไม่
    if (!config.DISCORD_CLIENT_ID || !config.DISCORD_CLIENT_SECRET) {
        logger.error('Discord OAuth not configured: DISCORD_CLIENT_ID or DISDIRECT_CLIENT_SECRET is missing');
        throw new Error('Discord OAuth is not configured. Please set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET environment variables.');
    }

    const params = new URLSearchParams({
        client_id: config.DISCORD_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'identify',
        prompt: 'consent'
    });

    if (state) {
        params.set('state', state);
    }
    
    const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
    logger.debug(`Auth URL generated (state: ${state || 'none'})`);
    
    return authUrl;
}

/**
 * แลก Authorization Code เป็น Access Token
 */
function exchangeCode(code) {
    logger.debug('Exchanging authorization code');
    
    return new Promise((resolve, reject) => {
        const data = new URLSearchParams({
            client_id: config.DISCORD_CLIENT_ID,
            client_secret: config.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI
        }).toString();

        const options = {
            hostname: 'discord.com',
            path: '/api/oauth2/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const request = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.access_token) {
                        logger.debug('Token exchange successful');
                        resolve(json.access_token);
                    } else {
                        reject(new Error(json.error_description || 'Failed to get access token'));
                    }
                } catch (err) {
                    reject(new Error('Invalid response from Discord'));
                }
            });
        });

        request.on('error', reject);
        request.write(data);
        request.end();
    });
}

/**
 * ดึงข้อมูล User จาก Discord API
 */
function getUserInfo(accessToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'discord.com',
            path: '/api/users/@me',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };

        const request = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.id) {
                        resolve({
                            id: json.id,
                            username: json.username,
                            discriminator: json.discriminator,
                            avatar: json.avatar,
                            displayName: json.global_name || json.username
                        });
                    } else {
                        reject(new Error('Failed to get user info'));
                    }
                } catch (err) {
                    reject(new Error('Invalid response from Discord'));
                }
            });
        });

        request.on('error', reject);
        request.end();
    });
}

module.exports = {
    getAuthUrl,
    exchangeCode,
    getUserInfo
};
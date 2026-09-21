/* ========================================
   Discord OAuth2 Service
   - จัดการ Discord Login
   ======================================== */

const https = require('https');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('DiscordAuth');
const REDIRECT_URI = `${config.APP_URL}/auth/discord/callback`;
const MAX_RETRIES = 3;

logger.info(`Config loaded - APP_URL: ${config.APP_URL}, REDIRECT_URI: ${REDIRECT_URI}`);

/**
 * แยกค่า retry_after จาก response ของ Discord (หน่วยมิลิวินาที)
 * ตรวจสอบทั้ง Retry-After header และ retry_after ใน JSON body
 */
function parseRetryAfter(res, body) {
    const headerRetryAfter = res.headers['retry-after'];
    if (headerRetryAfter) {
        return Math.ceil(parseFloat(headerRetryAfter) * 1000);
    }
    try {
        const json = JSON.parse(body);
        if (json.retry_after) {
            return Math.ceil(json.retry_after * 1000);
        }
    } catch (e) {}
    return 1000;
}

/**
 * ส่ง HTTP request ไปยัง Discord API พร้อม retry logic สำหรับ 429
 * @param {object} options - https.request options
 * @param {string|null} postData - ข้อมูล POST (null สำหรับ GET)
 * @returns {Promise<{statusCode, body, headers}>}
 */
function discordApiRequest(options, postData) {
    return new Promise((resolve, reject) => {
        function makeRequest(retriesLeft) {
            const requestOptions = {
                ...options,
                timeout: config.REQUEST_TIMEOUT || 10000
            };

            if (postData) {
                requestOptions.headers = {
                    ...options.headers,
                    'Content-Length': Buffer.byteLength(postData)
                };
            }

            const request = https.request(requestOptions, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    // 429 Rate Limited - retry with backoff
                    if (res.statusCode === 429 && retriesLeft > 0) {
                        const delay = parseRetryAfter(res, body);
                        logger.warn(`Discord rate limited, retrying in ${delay}ms (${retriesLeft} retries left)`);
                        setTimeout(() => makeRequest(retriesLeft - 1), delay);
                        return;
                    }

                    // ตรวจสอบสถานะ HTTP ก่อนประมวลผล
                    if (res.statusCode !== 200 && res.statusCode !== 201) {
                        let msg = `Discord API error: ${res.statusCode}`;
                        try {
                            const json = JSON.parse(body);
                            if (json.error) {
                                msg = json.error_description || json.message || json.error;
                            } else if (json.message) {
                                msg = json.message;
                            }
                        } catch (e) {
                            if (body) msg = body.substring(0, 200);
                        }
                        return reject(new Error(msg));
                    }

                    resolve({ statusCode: res.statusCode, body, headers: res.headers });
                });
            });

            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Request to Discord timed out'));
            });

            if (postData) {
                request.write(postData);
            }
            request.end();
        }

        makeRequest(MAX_RETRIES);
    });
}

/**
 * สร้าง URL สำหรับ Discord OAuth2 Login
 * @param {string} state - ระบุหน้าที่เรียก (เช่น 'register' หรือ 'council')
 */
function getAuthUrl(state = '') {
    if (!config.DISCORD_CLIENT_ID || !config.DISCORD_CLIENT_SECRET) {
        logger.error('Discord OAuth not configured: DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET is missing');
        throw new Error('Discord OAuth is not configured. Please set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET environment variables.');
    }

    const params = new URLSearchParams({
        client_id: config.DISCORD_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'identify'
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
async function exchangeCode(code) {
    logger.debug('Exchanging authorization code');

    const data = new URLSearchParams({
        client_id: config.DISCORD_CLIENT_ID,
        client_secret: config.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
    }).toString();

    const { body } = await discordApiRequest({
        hostname: 'discord.com',
        path: '/api/oauth2/token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, data);

    const json = JSON.parse(body);
    if (json.access_token) {
        logger.debug('Token exchange successful');
        return json.access_token;
    }
    throw new Error(json.message || 'Failed to get access token');
}

/**
 * ดึงข้อมูล User จาก Discord API
 */
async function getUserInfo(accessToken) {
    logger.debug('Fetching user info from Discord');

    const { body } = await discordApiRequest({
        hostname: 'discord.com',
        path: '/api/users/@me',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` }
    }, null);

    const json = JSON.parse(body);
    if (json.id) {
        logger.debug('User info fetched successfully');
        return {
            id: json.id,
            username: json.username,
            discriminator: json.discriminator,
            avatar: json.avatar,
            displayName: json.global_name || json.username
        };
    }
    throw new Error(json.message || 'Failed to get user info');
}

module.exports = {
    getAuthUrl,
    exchangeCode,
    getUserInfo
};
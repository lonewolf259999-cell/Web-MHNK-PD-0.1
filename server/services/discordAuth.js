/* ========================================
   Discord OAuth2 Service
   - จัดการ Discord Login
   ======================================== */

const https = require('https');
const config = require('../config');

const REDIRECT_URI = `${config.APP_URL}/auth/discord/callback`;

// Debug log
console.log('========================================');
console.log('[Discord Auth] Config loaded:');
console.log('  APP_URL:', config.APP_URL);
console.log('  REDIRECT_URI:', REDIRECT_URI);
console.log('  CLIENT_ID:', config.DISCORD_CLIENT_ID ? '***' + config.DISCORD_CLIENT_ID.slice(-4) : 'NOT SET');
console.log('========================================');

/**
 * สร้าง URL สำหรับ Discord OAuth2 Login
 */
function getAuthUrl() {
    const params = new URLSearchParams({
        client_id: config.DISCORD_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'identify',
        prompt: 'consent'
    });
    
    const authUrl = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
    console.log('[Discord Auth] Auth URL:', authUrl);
    
    return authUrl;
}

/**
 * แลก Authorization Code เป็น Access Token
 */
function exchangeCode(code) {
    console.log('[Discord Auth] Exchanging code with redirect_uri:', REDIRECT_URI);
    
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
                console.log('[Discord Auth] Token response status:', res.statusCode);
                console.log('[Discord Auth] Token response body:', body);
                try {
                    const json = JSON.parse(body);
                    if (json.access_token) {
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
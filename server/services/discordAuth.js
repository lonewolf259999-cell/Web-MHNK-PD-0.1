/* ========================================
   Discord OAuth2 Service
   - จัดการ Discord Login
   ======================================== */

const https = require('https');
const config = require('../config');

/**
 * สร้าง URL สำหรับ Discord OAuth2 Login
 */
function getAuthUrl() {
    const params = new URLSearchParams({
        client_id: config.DISCORD_CLIENT_ID,
        redirect_uri: `http://localhost:${config.PORT}/auth/discord/callback`,
        response_type: 'code',
        scope: 'identify',
        prompt: 'consent'
    });
    
    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

/**
 * แลก Authorization Code เป็น Access Token
 */
function exchangeCode(code) {
    return new Promise((resolve, reject) => {
        const data = new URLSearchParams({
            client_id: config.DISCORD_CLIENT_ID,
            client_secret: config.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: `http://localhost:${config.PORT}/auth/discord/callback`
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
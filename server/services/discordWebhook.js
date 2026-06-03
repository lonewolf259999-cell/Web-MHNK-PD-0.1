/* ========================================
   Discord Webhook Service
   - ส่งข้อมูลสมัครไปยัง Discord ผ่าน Webhook
   ======================================== */

const https = require('https');
const config = require('../config');

/**
 * ส่งข้อมูลสมัครไปยัง Discord Webhook
 * @param {Object} registrationData - ข้อมูลการสมัคร
 * @returns {Promise<Object>} - ผลลัพธ์การส่ง
 */
async function sendRegistration(registrationData) {
    const { ocName, icName, ocAge, icPhone, discordId, steamUrl } = registrationData;

    // ตรวจสอบว่า discordId เป็นตัวเลข (User ID) หรือไม่
    const isNumericId = /^\d+$/.test(discordId);
    const discordMention = isNumericId ? `<@${discordId}>` : discordId || 'ไม่ระบุ';
    const discordDisplay = isNumericId ? discordMention : discordId || 'ไม่ระบุ';

    // สร้าง Embed Message
    const embed = {
        title: '🚔 ใบสมัครตำรวจใหม่',
        description: 'มีผู้สมัครเข้าร่วมกรมตำรวจ MHNK',
        color: 0x1DC9B7, // Teal color ตรงกับ theme
        fields: [
            {
                name: '👤 ชื่อ OC',
                value: ocName || 'ไม่ระบุ',
                inline: true
            },
            {
                name: '📝 ชื่อ IC',
                value: icName || 'ไม่ระบุ',
                inline: true
            },
            {
                name: '🎂 อายุ OC',
                value: ocAge ? `${ocAge} ปี` : 'ไม่ระบุ',
                inline: true
            },
            {
                name: '📱 เบอร์ IC',
                value: icPhone || 'ไม่ระบุ',
                inline: true
            },
            {
                name: '💬 Discord',
                value: discordDisplay,
                inline: true
            },
            {
                name: '🎮 Steam',
                value: steamUrl ? `[คลิกดูโปรไฟล์](${steamUrl})` : 'ไม่ระบุ',
                inline: true
            }
        ],
        footer: {
            text: 'MHNK Police Department • ระบบสมัครอัตโนมัติ'
        },
        timestamp: new Date().toISOString()
    };

    const payload = JSON.stringify({ 
        content: discordMention !== 'ไม่ระบุ' ? discordMention : undefined,
        embeds: [embed] 
    });

    return new Promise((resolve, reject) => {
        const url = new URL(config.DISCORD_WEBHOOK_URL);
        
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const request = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 204 || res.statusCode === 200) {
                    resolve({ success: true, message: 'ส่งข้อมูลสำเร็จ' });
                } else {
                    reject(new Error(`Discord API returned status ${res.statusCode}`));
                }
            });
        });

        request.on('error', (err) => {
            console.error('[Discord Webhook] Error:', err.message);
            reject(err);
        });

        request.setTimeout(10000, () => {
            request.destroy();
            reject(new Error('Request timeout'));
        });

        request.write(payload);
        request.end();
    });
}

module.exports = { sendRegistration };
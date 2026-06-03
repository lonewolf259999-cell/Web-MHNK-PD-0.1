/* ========================================
    Controller - Proctor endpoints
    ======================================== */

const config = require('../config');
const { createLogger } = require('../utils/logger');
const https = require('https');
const http = require('http');

const logger = createLogger('ProctorController');

/**
 * ส่งค่า config ที่จำเป็นให้ frontend
 */
function getConfig(req, res) {
    res.json({
        webhookUrl: config.DISCORD_PROCTOR_WEBHOOK_URL,
        success: true
    });
}

/**
 * รับข้อมูลคุมสอบและส่งไปยัง Discord Webhook
 */
async function submitProctor(req, res) {
    try {
        const { proctorName, discordId, examineeName, examDate, image, notes } = req.body;

        // Validation
        if (!discordId) {
            return res.status(400).json({ success: false, error: 'กรุณาเชื่อมต่อ Discord ก่อนส่งข้อมูล' });
        }
        if (!examineeName || !examineeName.trim()) {
            return res.status(400).json({ success: false, error: 'กรุณากรอกชื่อผู้สอบ' });
        }
        if (!examDate) {
            return res.status(400).json({ success: false, error: 'กรุณาเลือกวันที่สอบ' });
        }

        // สร้าง Embed message
        const embed = {
            title: '📋 บันทึกการคุมสอบ',
            color: 0x1dc9b7,
            fields: [
                {
                    name: '👮 ผู้คุมสอบ',
                    value: proctorName || 'ไม่ระบุ',
                    inline: true
                },
                {
                    name: '👤 ผู้สอบ',
                    value: examineeName,
                    inline: true
                },
                {
                    name: '📅 วันที่สอบ',
                    value: examDate,
                    inline: true
                },
                {
                    name: '🆔 Discord ID',
                    value: `<@${discordId}>`,
                    inline: false
                }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'MHNK Police Department - Proctor System'
            }
        };

        // เพิ่มหมายเหตุถ้ามี
        if (notes && notes.trim()) {
            embed.fields.push({
                name: '📝 หมายเหตุ',
                value: notes.trim(),
                inline: false
            });
        }

        const webhookUrl = config.DISCORD_PROCTOR_WEBHOOK_URL;
        
        if (!webhookUrl) {
            logger.error('Discord Proctor Webhook URL is not configured');
            return res.status(500).json({ success: false, error: 'ระบบยังไม่ได้ตั้งค่า Webhook สำหรับ Proctor' });
        }

        // ส่งข้อมูลไป Webhook
        const payload = {
            content: `<@${discordId}>`,
            embeds: [embed]
        };

        if (image) {
            // มีรูปภาพ - ส่งเป็น multipart
            await sendWebhookWithImage(webhookUrl, embed, image, discordId);
        } else {
            // ไม่มีรูปภาพ - ส่ง JSON ปกติ
            await sendWebhook(webhookUrl, payload);
        }

        logger.info(`Proctor record submitted: ${examineeName} by ${proctorName}`);
        res.json({ success: true, message: 'บันทึกสำเร็จ' });

    } catch (err) {
        logger.error(`Proctor submit error: ${err.message}`);
        res.status(500).json({ success: false, error: 'ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง' });
    }
}

/**
 * ส่ง Webhook แบบ JSON
 */
function sendWebhook(url, payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const urlObj = new URL(url);
        
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const req = protocol.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(body);
                } else {
                    reject(new Error(`Webhook failed with status ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

/**
 * ส่ง Webhook พร้อมรูปภาพ
 */
function sendWebhookWithImage(url, embed, base64Image, discordId) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        
        // แยก base64 data
        const base64Data = base64Image.split(',')[1];
        const contentType = base64Image.split(';')[0].split(':')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // สร้าง boundary สำหรับ multipart
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        
        // สร้าง payload
        const jsonPart = JSON.stringify({
            content: `<@${discordId}>`,
            embeds: [embed]
        });
        
        // สร้าง multipart body
        const parts = [
            `--${boundary}`,
            'Content-Disposition: form-data; name="payload_json"',
            'Content-Type: application/json',
            '',
            jsonPart,
            `--${boundary}`,
            `Content-Disposition: form-data; name="files[0]"; filename="evidence.png"`,
            `Content-Type: ${contentType}`,
            '',
        ];
        
        const header = Buffer.from(parts.join('\r\n') + '\r\n');
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
        
        const body = Buffer.concat([header, imageBuffer, footer]);
        
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length
            }
        };

        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const req = protocol.request(options, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(responseBody);
                } else {
                    reject(new Error(`Webhook failed with status ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

module.exports = {
    getConfig,
    submitProctor
};
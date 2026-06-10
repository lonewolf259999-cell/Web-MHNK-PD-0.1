/* ========================================
   Discord Webhook Service (Unified)
   - ส่งข้อมูลไปยัง Discord Webhook ทั้งแบบมีรูปและไม่มีรูป
   - ใช้ร่วมกันทั้ง register, proctor และ council
   - รองรับการแก้ไขข้อความ (Edit) ผ่าน message ID
   ======================================== */

const https = require('https');
const http = require('http');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('DiscordWebhook');

/**
 * แก้ Webhook URL → เพิ่ม /messages/{messageId} สำหรับ PATCH
 */
function buildEditUrl(webhookUrl, messageId) {
    // webhookUrl = https://discord.com/api/webhooks/ID/TOKEN
    // editUrl   = https://discord.com/api/webhooks/ID/TOKEN/messages/msgId
    const base = webhookUrl.replace(/\/+$/, '');
    return `${base}/messages/${messageId}`;
}

/**
 * ส่ง Webhook แบบ JSON (POST) หรือแก้ไข (PATCH)
 * @param {string} url - Webhook URL
 * @param {Object} payload - JSON payload
 * @param {string} [method] - 'POST' (default) or 'PATCH'
 * @returns {Promise<Object>} - parsed JSON response
 */
function sendJson(url, payload, method = 'POST') {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const urlObj = new URL(url);

        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            },
            timeout: config.REQUEST_TIMEOUT
        };

        const protocol = urlObj.protocol === 'https:' ? https : http;
        const req = protocol.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(body ? JSON.parse(body) : {});
                    } catch {
                        resolve(body || {});
                    }
                } else if (res.statusCode === 404) {
                    reject(new Error('ไม่พบข้อความใน Discord (messageId ไม่ถูกต้องหรือถูกลบแล้ว)'));
                } else if (res.statusCode === 429) {
                    reject(new Error(' Discord API rate limit กรุณารอสักครู่แล้วลองใหม่'));
                } else {
                    reject(new Error(`Discord API error: ${res.statusCode} - ${body.slice(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Discord API request timeout'));
        });
        req.write(data);
        req.end();
    });
}

/**
 * ส่ง Webhook พร้อมรูปภาพ (multipart/form-data)
 * ใช้ร่วมกันทั้ง proctor และ council
 * @param {string} url - Webhook URL
 * @param {Object} embed - Discord embed object
 * @param {string} base64Image - รูปภาพแบบ base64
 * @param {string} discordId - Discord user ID สำหรับ mention
 * @param {string} filename - ชื่อไฟล์แนบ (default: 'evidence.png')
 */
function sendMultipart(url, embed, base64Image, discordId, filename = 'evidence.png') {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);

        // แยก base64 data
        const base64Data = base64Image.split(',')[1];
        const contentType = base64Image.split(';')[0].split(':')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // สร้าง boundary สำหรับ multipart
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

        // สร้าง multipart body
        const payloadJson = JSON.stringify({
            content: discordId ? `<@${discordId}>` : undefined,
            embeds: [embed]
        });

        const parts = [
            `--${boundary}`,
            'Content-Disposition: form-data; name="payload_json"',
            'Content-Type: application/json',
            '',
            payloadJson,
            `--${boundary}`,
            `Content-Disposition: form-data; name="files[0]"; filename="${filename}"`,
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
            },
            timeout: config.REQUEST_TIMEOUT
        };

        const protocol = urlObj.protocol === 'https:' ? https : http;
        const req = protocol.request(options, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(responseBody));
                    } catch {
                        resolve(responseBody);
                    }
                } else {
                    reject(new Error(`Webhook failed with status ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Webhook request timeout'));
        });
        req.write(body);
        req.end();
    });
}

/**
 * สร้าง embed สำหรับใบสมัคร
 */
function buildRegistrationEmbed(data, editCount = 0) {
    const { ocName, icName, ocAge, icPhone, discordId, steamUrl } = data;

    // ตรวจสอบว่า discordId เป็นตัวเลข (User ID) หรือไม่
    const isNumericId = /^\d+$/.test(discordId);
    const discordMention = isNumericId ? `<@${discordId}>` : discordId || 'ไม่ระบุ';
    const discordDisplay = isNumericId ? discordMention : discordId || 'ไม่ระบุ';

    const footerText = editCount > 0
        ? `✏️ แก้ไขแล้ว ${editCount} ครั้ง • MHNK Police Department`
        : 'MHNK Police Department • ระบบสมัครอัตโนมัติ';

    return {
        embed: {
            title: '🚔 ใบสมัครตำรวจใหม่',
            description: 'มีผู้สมัครเข้าร่วมกรมตำรวจ MHNK',
            color: 0x1DC9B7,
            fields: [
                { name: '👤 ชื่อ เล่น IC', value: ocName || 'ไม่ระบุ', inline: true },
                { name: '📝 ชื่อ IC / ชื่อตามบัตรประชาชน', value: icName || 'ไม่ระบุ', inline: true },
                { name: '🎂 อายุ OC', value: ocAge ? `${ocAge} ปี` : 'ไม่ระบุ', inline: true },
                { name: '📱 เบอร์ IC', value: icPhone || 'ไม่ระบุ', inline: true },
                { name: '💬 Discord', value: discordDisplay, inline: true },
                { name: '🎮 Steam', value: steamUrl || 'ไม่ระบุ', inline: true }
            ],
            footer: { text: footerText },
            timestamp: new Date().toISOString()
        },
        content: discordMention !== 'ไม่ระบุ' ? discordMention : undefined
    };
}

/**
 * ส่งข้อมูลสมัครไปยัง Discord Webhook (Register)
 * @param {Object} registrationData - ข้อมูลการสมัคร
 * @returns {Promise<Object>} - { success, messageId }
 */
async function sendRegistration(registrationData) {
    const { ocName, icName, ocAge, icPhone, discordId, steamUrl } = registrationData;

    const webhookUrl = config.DISCORD_REGISTER_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.error('Discord Register Webhook URL is not configured');
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับการสมัคร');
    }

    const { embed, content } = buildRegistrationEmbed(registrationData, 0);
    const payload = {
        content,
        embeds: [embed]
    };

    // ส่ง Webhook และรับ messageId กลับมา
    const response = await sendJson(webhookUrl, payload);
    const messageId = response.id;

    if (!messageId) {
        logger.error('Discord did not return a message ID');
        throw new Error('Discord ไม่ได้คืน message ID — อาจเป็นปัญหา Discord API');
    }

    logger.info(`Registration sent: ${ocName} (${discordId}) msgId=${messageId}`);
    return { success: true, message: 'ส่งข้อมูลสำเร็จ', messageId };
}

/**
 * แก้ไขข้อความใน Discord (PATCH embed)
 * @param {Object} opts
 * @param {string} opts.messageId - Discord Message ID
 * @param {Object} opts.data - ข้อมูลใหม่ { ocName, icName, ocAge, icPhone, discordId, steamUrl }
 * @param {number} [opts.editCount] - จำนวนครั้งที่แก้ไขแล้ว
 * @returns {Promise<Object>}
 */
async function editRegistrationMessage({ messageId, data, editCount = 1 }) {
    const { ocName, discordId } = data;

    const webhookUrl = config.DISCORD_REGISTER_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.error('Discord Register Webhook URL is not configured');
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับการสมัคร');
    }

    if (!messageId) {
        throw new Error('กรุณาระบุ Message ID');
    }

    const editUrl = buildEditUrl(webhookUrl, messageId);
    const { embed, content } = buildRegistrationEmbed(data, editCount);
    const payload = {
        content,
        embeds: [embed]
    };

    // PATCH แก้ไข embed
    await sendJson(editUrl, payload, 'PATCH');

    logger.info(`Registration edited: ${ocName} (${discordId}) msgId=${messageId} editCount=${editCount}`);
    return { success: true, message: 'แก้ไขข้อมูลสำเร็จ' };
}

/**
 * ส่งข้อมูลคุมสอบไปยัง Discord Webhook (Proctor)
 * @param {Object} proctorData - ข้อมูลการคุมสอบ
 * @returns {Promise<Object>} - ผลลัพธ์การส่ง
 */
async function sendProctor(proctorData) {
    const { proctorName, discordId, examineeName, examDate, notes, image } = proctorData;

    const embed = {
        title: '📋 บันทึกการคุมสอบ Proctor',
        color: 0x1dc9b7,
        fields: [
            { name: '👮 ผู้คุมสอบ', value: proctorName || 'ไม่ระบุ', inline: true },
            { name: '👤 ผู้สอบ', value: examineeName, inline: true },
            { name: '📅 วันที่สอบ', value: examDate, inline: true },
            { name: '🆔 Discord ID', value: `<@${discordId}>`, inline: false }
        ],
        timestamp: new Date().toISOString(),
        footer: { text: 'MHNK Police Department - Proctor System' }
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
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับ Proctor');
    }

    if (image) {
        await sendMultipart(webhookUrl, embed, image, discordId, 'evidence.png');
    } else {
        await sendJson(webhookUrl, { content: `<@${discordId}>`, embeds: [embed] });
    }

    logger.info(`Proctor record submitted: ${examineeName} by ${proctorName}`);
    return { success: true, message: 'บันทึกสำเร็จ' };
}

/**
 * ส่งข้อมูลสัญญาสตอรีไปยัง Discord Webhook (Council)
 * @param {Object} councilData - ข้อมูลสัญญาสตอรี
 * @returns {Promise<Object>} - ผลลัพธ์การส่ง
 */
async function sendCouncil(councilData) {
    const {
        discordId,
        gangA, slotA,
        gangB, slotB,
        betAmount, fightCount, location,
        dateStart, dateEnd, startTime,
        preEventActivity,
        outfitA, outfitB,
        bluffRules, notes,
        image
    } = councilData;

    const formatNumber = (num) => {
        return Number(num).toLocaleString('en-US');
    };

    const fields = [
        { name: '\u200B', value: `🟣 **${gangA}** \`${formatNumber(slotA)} SLOT\``, inline: false },
        { name: '　　　　　　... VS ...', value: `🔴 **${gangB}** \`${formatNumber(slotB)} SLOT\``, inline: false },
        { name: '💰 มูลค่าเดิมพัน', value: `\`${formatNumber(betAmount)} IC\``, inline: true },
        { name: '⚔️ จำนวนไฟต์', value: `\`${fightCount} ไฟต์\``, inline: true },
        { name: '📍 สถานที่', value: `\`${location}\``, inline: true },
        { name: '🎮 กิจกรรมก่อนเริ่ม', value: `\`${preEventActivity}\``, inline: false },
        { name: '📅 วันที่', value: `\`${dateStart} → ${dateEnd}\``, inline: false },
        { name: '🕐 เวลาเริ่ม', value: `\`${startTime}\``, inline: false },
        { name: '👕 ชุดที่ใส่', value: `🟣 **${gangA}** : \`${outfitA}\`\n🔴 **${gangB}** : \`${outfitB}\``, inline: false },
        { name: '📋 กติกาการบลัฟ', value: bluffRules || 'การบลัฟ • 100% (พิมเอง)', inline: false },
    ];

    // เพิ่มหมายเหตุถ้ามี
    if (notes && notes.trim()) {
        fields.push({ name: '📝 หมายเหตุ', value: notes.trim(), inline: false });
    }

    const discordName = councilData.discordName || '';
    const embed = {
        title: '📜 สัญญาสตอรี',
        description: discordName ? `👤 ผู้ดำเนินการ : **${discordName}**` : undefined,
        fields: fields,
        color: 0x9b59b6, // สีม่วง
        footer: { text: 'MHNK Police Department • สัญญาสตอรี' },
        timestamp: new Date().toISOString()
    };

    // ถ้ามีรูป merged (composite) ให้เพิ่ม image field ใน embed หลัก
    if (image) {
        embed.image = { url: 'attachment://council.png' };
    }

    const webhookUrl = config.DISCORD_COUNCIL_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.error('Discord Council Webhook URL is not configured');
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับสัญญาสตอรี');
    }

    if (image) {
        await sendMultipart(webhookUrl, embed, image, discordId, 'council.png');
    } else {
        const payload = { content: `<@${discordId}>`, embeds: [embed] };
        await sendJson(webhookUrl, payload);
    }

    logger.info(`Council record submitted: ${gangA} vs ${gangB}`);
    return { success: true, message: 'บันทึกสำเร็จ' };
}

module.exports = { sendRegistration, sendProctor, sendCouncil, editRegistrationMessage };
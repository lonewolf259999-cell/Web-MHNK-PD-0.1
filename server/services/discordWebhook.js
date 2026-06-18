/* ========================================
   Discord Webhook Service (Unified)
   - ส่งข้อมูลไปยัง Discord Webhook ทั้งแบบมีรูปและไม่มีรูป
   - ใช้สำหรับ register และ medical
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
        const data = method !== 'GET' ? JSON.stringify(payload) : null;
        const urlObj = new URL(url);

        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search, // รวม query string เช่น ?wait=true
            method: method,
            headers: {},
            timeout: config.REQUEST_TIMEOUT
        };

        if (method !== 'GET') {
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }

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
        if (data !== null) {
            req.write(data);
        }
        req.end();
    });
}

/**
 * ส่ง Webhook พร้อมรูปภาพ (multipart/form-data)
 * ใช้สำหรับ council
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

    // ต้องใช้ ?wait=true เพื่อให้ Discord คืน message object (มี id กลับมา)
    // ถ้าไม่ใช้ ?wait=true Discord จะคืน 204 No Content (ไม่มี body)
    const waitUrl = webhookUrl + (webhookUrl.includes('?') ? '&' : '?') + 'wait=true';

    // ส่ง Webhook และรับ messageId กลับมา
    const response = await sendJson(waitUrl, payload);
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
 * @param {string} [opts.verifiedDiscordUserId] - Discord User ID สำหรับตรวจสอบความเป็นเจ้าของ
 * @returns {Promise<Object>}
 */
async function editRegistrationMessage({ messageId, data, editCount = 1, verifiedDiscordUserId }) {
    const { ocName, discordId } = data;

    const webhookUrl = config.DISCORD_REGISTER_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.error('Discord Register Webhook URL is not configured');
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับการสมัคร');
    }

    if (!messageId) {
        throw new Error('กรุณาระบุ Message ID');
    }

    // === ตรวจสอบความเป็นเจ้าของ (ถ้ามี verifiedDiscordUserId) ===
    if (verifiedDiscordUserId) {
        const fetchUrl = buildEditUrl(webhookUrl, messageId);
        const existingMessage = await sendJson(fetchUrl, {}, 'GET');

        // ตรวจสอบว่า content ของ message มี <@verifiedDiscordUserId> หรือไม่
        const mentionPattern = `<@${verifiedDiscordUserId}>`;
        const contentMatch = existingMessage.content && existingMessage.content.includes(mentionPattern);

        // ตรวจสอบใน embed fields ด้วย
        let fieldMatch = false;
        if (existingMessage.embeds && existingMessage.embeds.length > 0) {
            const fields = existingMessage.embeds[0].fields || [];
            for (const field of fields) {
                if (field.value && field.value.includes(mentionPattern)) {
                    fieldMatch = true;
                    break;
                }
            }
        }

        if (!contentMatch && !fieldMatch) {
            throw new Error('❌ ไม่ใช่ข้อมูลของคุณ — Message ID นี้เป็นของคนอื่น');
        }
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
 * ดึงข้อมูลจาก Discord embed (GET message) เพื่อโหลดข้อมูลเก่า
 * @param {string} messageId - Discord Message ID
 * @param {string} [verifiedDiscordUserId] - Discord User ID สำหรับตรวจสอบความเป็นเจ้าของ
 * @returns {Promise<Object>} - { ocName, icName, ocAge, icPhone, discordId, steamUrl }
 */
async function fetchRegistrationMessage(messageId, verifiedDiscordUserId) {
    const webhookUrl = config.DISCORD_REGISTER_WEBHOOK_URL;
    if (!webhookUrl) {
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับการสมัคร');
    }
    if (!messageId) {
        throw new Error('กรุณาระบุ Message ID');
    }

    const fetchUrl = buildEditUrl(webhookUrl, messageId); // GET endpoint เหมือนกับ edit
    const response = await sendJson(fetchUrl, {}, 'GET');

    if (!response || !response.embeds || response.embeds.length === 0) {
        throw new Error('ไม่พบ embed ในข้อความนี้ — Message ID อาจไม่ถูกต้อง');
    }

    const embed = response.embeds[0];
    const fields = embed.fields || [];

    // === ตรวจสอบความเป็นเจ้าของ (ถ้ามี verifiedDiscordUserId) ===
    if (verifiedDiscordUserId) {
        const mentionPattern = `<@${verifiedDiscordUserId}>`;
        const contentMatch = response.content && response.content.includes(mentionPattern);

        let fieldMatch = false;
        for (const field of fields) {
            if (field.value && field.value.includes(mentionPattern)) {
                fieldMatch = true;
                break;
            }
        }

        if (!contentMatch && !fieldMatch) {
            throw new Error('❌ ไม่ใช่ข้อมูลของคุณ — Message ID นี้เป็นของคนอื่น');
        }
    }

    // Map fields from embed to registration data
    const getFieldValue = (name) => {
        const field = fields.find(f => f.name.includes(name));
        return field ? field.value.replace(/\*\*/g, '').trim() : '';
    };

    const data = {
        ocName: getFieldValue('ชื่อ เล่น IC'),
        icName: getFieldValue('ชื่อ IC'),
        ocAge: parseInt(getFieldValue('อายุ OC')) || '',
        icPhone: getFieldValue('เบอร์ IC'),
        discordId: getFieldValue('Discord'),
        steamUrl: getFieldValue('Steam'),
    };

    // Get editCount from footer if present
    let editCount = 0;
    if (embed.footer && embed.footer.text) {
        const match = embed.footer.text.match(/แก้ไขแล้ว (\d+) ครั้ง/);
        if (match) editCount = parseInt(match[1]);
    }

    return { data, editCount, messageId };
}

/**
 * สร้าง embed สำหรับใบสมัครแพทย์
 */
function buildMedicalEmbed(data, editCount = 0) {
    const { icName, ocAge, timeStart, timeEnd, medicalExperience, joinReason, discordId } = data;

    // ตรวจสอบว่า discordId เป็นตัวเลข (User ID) หรือไม่
    const isNumericId = /^\d+$/.test(discordId);
    const discordMention = isNumericId ? `<@${discordId}>` : discordId || 'ไม่ระบุ';
    const discordDisplay = isNumericId ? discordMention : discordId || 'ไม่ระบุ';

    const footerText = editCount > 0
        ? `✏️ แก้ไขแล้ว ${editCount} ครั้ง • MHNK Medical Department`
        : 'MHNK Medical Department • ระบบสมัครอัตโนมัติ';

    // ตัดข้อความถ้ายาวเกินไปสำหรับ embed field (Discord limit = 1024 chars)
    const truncate = (str, max = 1000) => str.length > max ? str.substring(0, max) + '...' : str;

    const formatTimeRange = (start, end) => {
        if (!start && !end) return 'ไม่ระบุ';
        return `${start || '—'} - ${end || '—'}`;
    };

    return {
        embed: {
            title: '❤️‍🩹 ใบสมัครแพทย์ใหม่',
            description: 'ผู้สมัครเข้าร่วมหน่วยแพทย์ MHNK',
            color: 0xef4444,
            fields: [
                { name: '📛 ชื่อ - นามสกุล (IC/ตามบัตร)', value: icName || 'ไม่ระบุ', inline: false },
                { name: '🎂 อายุ (OC)', value: ocAge ? `${ocAge} ปี` : 'ไม่ระบุ', inline: true },
                { name: '💬 Discord', value: discordDisplay, inline: true },
                { name: '⏰ เวลาที่สามารถปฏิบัติหน้าที่ได้', value: formatTimeRange(timeStart, timeEnd), inline: false },
                { name: '💊 ประสบการณ์ด้านสายแพทย์', value: truncate(medicalExperience), inline: false },
                { name: '💡 เหตุผลที่ต้องการเข้าร่วม', value: truncate(joinReason), inline: false }
            ],
            footer: { text: footerText },
            timestamp: new Date().toISOString()
        },
        content: discordMention !== 'ไม่ระบุ' ? discordMention : undefined
    };
}

/**
 * ส่งข้อมูลสมัครแพทย์ไปยัง Discord Webhook
 * @param {Object} medicalData - ข้อมูลการสมัครแพทย์
 * @returns {Promise<Object>} - { success, messageId }
 */
async function sendMedical(medicalData) {
    const { icName, discordId } = medicalData;

    const webhookUrl = config.DISCORD_MEDICAL_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.error('Discord Medical Webhook URL is not configured');
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับการสมัครแพทย์');
    }

    const { embed, content } = buildMedicalEmbed(medicalData, 0);
    const payload = {
        content,
        embeds: [embed]
    };

    // ต้องใช้ ?wait=true เพื่อให้ Discord คืน message object (มี id กลับมา)
    const waitUrl = webhookUrl + (webhookUrl.includes('?') ? '&' : '?') + 'wait=true';

    // ส่ง Webhook และรับ messageId กลับมา
    const response = await sendJson(waitUrl, payload);
    const messageId = response.id;

    if (!messageId) {
        logger.error('Discord did not return a message ID');
        throw new Error('Discord ไม่ได้คืน message ID — อาจเป็นปัญหา Discord API');
    }

    logger.info(`Medical registration sent: ${icName} (${discordId}) msgId=${messageId}`);
    return { success: true, message: 'ส่งข้อมูลสำเร็จ', messageId };
}

/**
 * แก้ไขข้อความใน Discord (PATCH embed) - Medical
 * @param {Object} opts
 * @param {string} opts.messageId - Discord Message ID
 * @param {Object} opts.data - ข้อมูลใหม่
 * @param {number} [opts.editCount] - จำนวนครั้งที่แก้ไขแล้ว
 * @param {string} [opts.verifiedDiscordUserId] - Discord User ID สำหรับตรวจสอบความเป็นเจ้าของ
 * @returns {Promise<Object>}
 */
async function editMedicalMessage({ messageId, data, editCount = 1, verifiedDiscordUserId }) {
    const { icName, discordId } = data;

    const webhookUrl = config.DISCORD_MEDICAL_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.error('Discord Medical Webhook URL is not configured');
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับการสมัครแพทย์');
    }

    if (!messageId) {
        throw new Error('กรุณาระบุ Message ID');
    }

    // === ตรวจสอบความเป็นเจ้าของ (ถ้ามี verifiedDiscordUserId) ===
    if (verifiedDiscordUserId) {
        const fetchUrl = buildEditUrl(webhookUrl, messageId);
        const existingMessage = await sendJson(fetchUrl, {}, 'GET');

        const mentionPattern = `<@${verifiedDiscordUserId}>`;
        const contentMatch = existingMessage.content && existingMessage.content.includes(mentionPattern);

        let fieldMatch = false;
        if (existingMessage.embeds && existingMessage.embeds.length > 0) {
            const fields = existingMessage.embeds[0].fields || [];
            for (const field of fields) {
                if (field.value && field.value.includes(mentionPattern)) {
                    fieldMatch = true;
                    break;
                }
            }
        }

        if (!contentMatch && !fieldMatch) {
            throw new Error('❌ ไม่ใช่ข้อมูลของคุณ — Message ID นี้เป็นของคนอื่น');
        }
    }

    const editUrl = buildEditUrl(webhookUrl, messageId);
    const { embed, content } = buildMedicalEmbed(data, editCount);
    const payload = {
        content,
        embeds: [embed]
    };

    // PATCH แก้ไข embed
    await sendJson(editUrl, payload, 'PATCH');

    logger.info(`Medical registration edited: ${icName} (${discordId}) msgId=${messageId} editCount=${editCount}`);
    return { success: true, message: 'แก้ไขข้อมูลสำเร็จ' };
}

/**
 * ดึงข้อมูลจาก Discord embed (GET message) เพื่อโหลดข้อมูลเก่า - Medical
 * @param {string} messageId - Discord Message ID
 * @param {string} [verifiedDiscordUserId] - Discord User ID สำหรับตรวจสอบความเป็นเจ้าของ
 * @returns {Promise<Object>}
 */
async function fetchMedicalMessage(messageId, verifiedDiscordUserId) {
    const webhookUrl = config.DISCORD_MEDICAL_WEBHOOK_URL;
    if (!webhookUrl) {
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับการสมัครแพทย์');
    }
    if (!messageId) {
        throw new Error('กรุณาระบุ Message ID');
    }

    const fetchUrl = buildEditUrl(webhookUrl, messageId);
    const response = await sendJson(fetchUrl, {}, 'GET');

    if (!response || !response.embeds || response.embeds.length === 0) {
        throw new Error('ไม่พบ embed ในข้อความนี้ — Message ID อาจไม่ถูกต้อง');
    }

    const embed = response.embeds[0];
    const fields = embed.fields || [];

    // === ตรวจสอบความเป็นเจ้าของ (ถ้ามี verifiedDiscordUserId) ===
    if (verifiedDiscordUserId) {
        const mentionPattern = `<@${verifiedDiscordUserId}>`;
        const contentMatch = response.content && response.content.includes(mentionPattern);

        let fieldMatch = false;
        for (const field of fields) {
            if (field.value && field.value.includes(mentionPattern)) {
                fieldMatch = true;
                break;
            }
        }

        if (!contentMatch && !fieldMatch) {
            throw new Error('❌ ไม่ใช่ข้อมูลของคุณ — Message ID นี้เป็นของคนอื่น');
        }
    }

    // Map fields from embed to medical registration data
    const getFieldValue = (name) => {
        const field = fields.find(f => f.name.includes(name));
        if (!field) return '';
        let value = field.value.replace(/\*\*/g, '').trim();
        value = value.replace(/<@\d+>/g, '').trim();
        return value;
    };

    // ดึงเวลาจาก field ที่มีรูปแบบ "HH:MM - HH:MM"
    const getTimeRange = () => {
        const field = fields.find(f => f.name.includes('เวลาที่สามารถปฏิบัติหน้าที่ได้'));
        if (!field) return { timeStart: '', timeEnd: '' };
        
        let value = field.value.replace(/\*\*/g, '').trim();
        const timeRegex = '(\\d{1,2}:\\d{2})';
        const match = value.match(new RegExp(timeRegex + '\\s*[-–]\\s*' + timeRegex));
        
        if (match) {
            return { timeStart: match[1], timeEnd: match[2] };
        }
        return { timeStart: '', timeEnd: '' };
    };

    const timeRange = getTimeRange();

    const data = {
        icName: getFieldValue('ชื่อ - นามสกุล'),
        ocAge: parseInt(getFieldValue('อายุ')) || '',
        timeStart: timeRange.timeStart,
        timeEnd: timeRange.timeEnd,
        medicalExperience: getFieldValue('ประสบการณ์ด้านสายแพทย์'),
        joinReason: getFieldValue('เหตุผลที่ต้องการเข้าร่วม'),
                discordId: getFieldValue('Discord'),
    };

    // Get editCount from footer if present
    let editCount = 0;
    if (embed.footer && embed.footer.text) {
        const match = embed.footer.text.match(/แก้ไขแล้ว (\d+) ครั้ง/);
        if (match) editCount = parseInt(match[1]);
    }

    return { data, editCount, messageId };
}

/**
 * สร้าง embed สำหรับ Proctor Approval
 */
function buildProctorEmbed(proctor, applicant) {
    const thaiDate = new Date().toLocaleString('th-TH', { 
        timeZone: 'Asia/Bangkok',
        weekday: 'long',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
    const shortDate = new Date().toISOString().split('T')[0];

    return {
        embed: {
            title: '📋 บันทึกการคุมสอบ Proctor',
            color: 0x1DC9B7,
            fields: [
                { name: '👮 ผู้คุมสอบ', value: applicant.discordName || 'ไม่ระบุ', inline: false },
                { name: '👤 ผู้สอบ', value: applicant.icName || 'ไม่ระบุ', inline: true },
                { name: '📅 วันที่สอบ', value: shortDate, inline: true },
                { name: '🆔 Discord ID ผู้สอบ', value: applicant.discordId || 'ไม่ระบุ', inline: false }
            ],
            footer: { text: `MHNK Police Department - Proctor System • ${thaiDate}` },
            timestamp: new Date().toISOString()
        }
    };
}

/**
 * ส่ง Proctor Approved webhook
 * @param {Object} proctor - { id, name }
 * @param {Object} applicant - { discordId, discordName, icName }
 * @returns {Promise<void>}
 */
async function sendProctorWebhook(proctor, applicant) {
    const webhookUrl = config.DISCORD_PROCTOR_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.warn('DISCORD_PROCTOR_WEBHOOK_URL not configured — skipping proctor webhook');
        return;
    }

    const { embed } = buildProctorEmbed(proctor, applicant);

    const payload = {
        content: `@${applicant.discordName}`,
        embeds: [embed]
    };

    const waitUrl = webhookUrl + (webhookUrl.includes('?') ? '&' : '?') + 'wait=true';
    await sendJson(waitUrl, payload);
    logger.info(`Proctor webhook sent: proctor=${proctor.id} applicant=${applicant.icName}`);
}

module.exports = { sendRegistration, editRegistrationMessage, fetchRegistrationMessage, sendMedical, editMedicalMessage, fetchMedicalMessage, sendProctorWebhook };
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

// ========== Helper Utilities ==========

function buildEditUrl(webhookUrl, messageId) {
    const base = webhookUrl.replace(/\/+$/, '');
    return `${base}/messages/${messageId}`;
}

function buildWaitUrl(webhookUrl) {
    return webhookUrl + (webhookUrl.includes('?') ? '&' : '?') + 'wait=true';
}

function toDiscordMention(discordId) {
    if (!discordId) return 'ไม่ระบุ';
    return /^\d+$/.test(discordId) ? `<@${discordId}>` : discordId;
}

function toDiscordDisplay(discordId) {
    return toDiscordMention(discordId);
}

/**
 * ตรวจสอบความเป็นเจ้าของ message โดยหา <@userId> ใน content หรือ embed fields
 */
async function verifyOwnership(webhookUrl, messageId, userId) {
    if (!userId) return;

    const fetchUrl = buildEditUrl(webhookUrl, messageId);
    const existingMessage = await sendJson(fetchUrl, {}, 'GET');

    const mentionPattern = `<@${userId}>`;
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

/**
 * สร้าง embed fields จาก registration data
 */
function buildRegistrationEmbed(data, editCount = 0) {
    const { ocName, icName, ocAge, icPhone, discordId, steamUrl } = data;

    const discordDisplay = toDiscordDisplay(discordId);
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
        content: discordDisplay !== 'ไม่ระบุ' ? discordDisplay : undefined
    };
}

function buildMedicalEmbed(data, editCount = 0) {
    const { icName, ocAge, timeStart, timeEnd, medicalExperience, joinReason, discordId } = data;

    const discordDisplay = toDiscordDisplay(discordId);
    const footerText = editCount > 0
        ? `✏️ แก้ไขแล้ว ${editCount} ครั้ง • MHNK Medical Department`
        : 'MHNK Medical Department • ระบบสมัครอัตโนมัติ';

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
        content: discordDisplay !== 'ไม่ระบุ' ? discordDisplay : undefined
    };
}

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
                { name: '👮 ผู้คุมสอบ', value: proctor.id ? `<@${proctor.id}>` : (proctor.name || 'ไม่ระบุ'), inline: false },
                { name: '👤 ผู้สอบ', value: applicant.icName || 'ไม่ระบุ', inline: true },
                { name: '📅 วันที่สอบ', value: shortDate, inline: true },
                { name: '🆔 Discord ID ผู้สอบ', value: applicant.discordId ? `<@${applicant.discordId}>` : 'ไม่ระบุ', inline: false }
            ],
            footer: { text: `MHNK Police Department - Proctor System • ${thaiDate}` },
            timestamp: new Date().toISOString()
        }
    };
}

// ========== HTTP Request ==========

function sendJson(url, payload, method = 'POST') {
    return new Promise((resolve, reject) => {
        const data = method !== 'GET' ? JSON.stringify(payload) : null;
        const urlObj = new URL(url);

        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
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
                    reject(new Error('Discord API rate limit กรุณารอสักครู่แล้วลองใหม่'));
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
        if (data !== null) req.write(data);
        req.end();
    });
}

// ========== Send Webhook / Edit / Fetch ==========

async function sendRegistration(registrationData) {
    const { ocName, icName, ocAge, icPhone, discordId, steamUrl } = registrationData;

    const webhookUrl = config.DISCORD_REGISTER_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.error('Discord Register Webhook URL is not configured');
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับการสมัคร');
    }

    const { embed, content } = buildRegistrationEmbed(registrationData, 0);
    const payload = { content, embeds: [embed] };

    const response = await sendJson(buildWaitUrl(webhookUrl), payload);
    const messageId = response.id;

    if (!messageId) {
        logger.error('Discord did not return a message ID');
        throw new Error('Discord ไม่ได้คืน message ID — อาจเป็นปัญหา Discord API');
    }

    logger.info(`Registration sent: ${ocName} (${discordId}) msgId=${messageId}`);
    return { success: true, message: 'ส่งข้อมูลสำเร็จ', messageId };
}

async function editRegistrationMessage({ messageId, data, editCount = 1, verifiedDiscordUserId }) {
    const { ocName, discordId } = data;

    const webhookUrl = config.DISCORD_REGISTER_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.error('Discord Register Webhook URL is not configured');
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับการสมัคร');
    }
    if (!messageId) throw new Error('กรุณาระบุ Message ID');

    if (verifiedDiscordUserId) {
        await verifyOwnership(webhookUrl, messageId, verifiedDiscordUserId);
    }

    const editUrl = buildEditUrl(webhookUrl, messageId);
    const { embed, content } = buildRegistrationEmbed(data, editCount);
    await sendJson(editUrl, { content, embeds: [embed] }, 'PATCH');

    logger.info(`Registration edited: ${ocName} (${discordId}) msgId=${messageId} editCount=${editCount}`);
    return { success: true, message: 'แก้ไขข้อมูลสำเร็จ' };
}

async function fetchRegistrationMessage(messageId, verifiedDiscordUserId) {
    const webhookUrl = config.DISCORD_REGISTER_WEBHOOK_URL;
    if (!webhookUrl) throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับการสมัคร');
    if (!messageId) throw new Error('กรุณาระบุ Message ID');

    const fetchUrl = buildEditUrl(webhookUrl, messageId);
    const response = await sendJson(fetchUrl, {}, 'GET');

    if (!response || !response.embeds || response.embeds.length === 0) {
        throw new Error('ไม่พบ embed ในข้อความนี้ — Message ID อาจไม่ถูกต้อง');
    }

    const embed = response.embeds[0];
    const fields = embed.fields || [];

    if (verifiedDiscordUserId) {
        await verifyOwnership(webhookUrl, messageId, verifiedDiscordUserId);
    }

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

    let editCount = 0;
    if (embed.footer && embed.footer.text) {
        const match = embed.footer.text.match(/แก้ไขแล้ว (\d+) ครั้ง/);
        if (match) editCount = parseInt(match[1]);
    }

    return { data, editCount, messageId };
}

async function sendMedical(medicalData) {
    const { icName, discordId } = medicalData;

    const webhookUrl = config.DISCORD_MEDICAL_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.error('Discord Medical Webhook URL is not configured');
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับการสมัครแพทย์');
    }

    const { embed, content } = buildMedicalEmbed(medicalData, 0);
    const payload = { content, embeds: [embed] };

    const response = await sendJson(buildWaitUrl(webhookUrl), payload);
    const messageId = response.id;

    if (!messageId) {
        logger.error('Discord did not return a message ID');
        throw new Error('Discord ไม่ได้คืน message ID — อาจเป็นปัญหา Discord API');
    }

    logger.info(`Medical registration sent: ${icName} (${discordId}) msgId=${messageId}`);
    return { success: true, message: 'ส่งข้อมูลสำเร็จ', messageId };
}

async function editMedicalMessage({ messageId, data, editCount = 1, verifiedDiscordUserId }) {
    const { icName, discordId } = data;

    const webhookUrl = config.DISCORD_MEDICAL_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.error('Discord Medical Webhook URL is not configured');
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับการสมัครแพทย์');
    }
    if (!messageId) throw new Error('กรุณาระบุ Message ID');

    if (verifiedDiscordUserId) {
        await verifyOwnership(webhookUrl, messageId, verifiedDiscordUserId);
    }

    const editUrl = buildEditUrl(webhookUrl, messageId);
    const { embed, content } = buildMedicalEmbed(data, editCount);
    await sendJson(editUrl, { content, embeds: [embed] }, 'PATCH');

    logger.info(`Medical registration edited: ${icName} (${discordId}) msgId=${messageId} editCount=${editCount}`);
    return { success: true, message: 'แก้ไขข้อมูลสำเร็จ' };
}

async function fetchMedicalMessage(messageId, verifiedDiscordUserId) {
    const webhookUrl = config.DISCORD_MEDICAL_WEBHOOK_URL;
    if (!webhookUrl) throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับการสมัครแพทย์');
    if (!messageId) throw new Error('กรุณาระบุ Message ID');

    const fetchUrl = buildEditUrl(webhookUrl, messageId);
    const response = await sendJson(fetchUrl, {}, 'GET');

    if (!response || !response.embeds || response.embeds.length === 0) {
        throw new Error('ไม่พบ embed ในข้อความนี้ — Message ID อาจไม่ถูกต้อง');
    }

    const embed = response.embeds[0];
    const fields = embed.fields || [];

    if (verifiedDiscordUserId) {
        await verifyOwnership(webhookUrl, messageId, verifiedDiscordUserId);
    }

    const getFieldValue = (name) => {
        const field = fields.find(f => f.name.includes(name));
        if (!field) return '';
        let value = field.value.replace(/\*\*/g, '').trim();
        value = value.replace(/<@\d+>/g, '').trim();
        return value;
    };

    const getTimeRange = () => {
        const field = fields.find(f => f.name.includes('เวลาที่สามารถปฏิบัติหน้าที่ได้'));
        if (!field) return { timeStart: '', timeEnd: '' };
        let value = field.value.replace(/\*\*/g, '').trim();
        const timeRegex = '(\\d{1,2}:\\d{2})';
        const match = value.match(new RegExp(timeRegex + '\\s*[-–]\\s*' + timeRegex));
        return match ? { timeStart: match[1], timeEnd: match[2] } : { timeStart: '', timeEnd: '' };
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

    let editCount = 0;
    if (embed.footer && embed.footer.text) {
        const match = embed.footer.text.match(/แก้ไขแล้ว (\d+) ครั้ง/);
        if (match) editCount = parseInt(match[1]);
    }

    return { data, editCount, messageId };
}

async function sendProctorWebhook(proctor, applicant) {
    const webhookUrl = config.DISCORD_PROCTOR_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.warn('DISCORD_PROCTOR_WEBHOOK_URL not configured — skipping proctor webhook');
        return;
    }

    const { embed } = buildProctorEmbed(proctor, applicant);

    const payload = {
        content: proctor.id ? `<@${proctor.id}>` : undefined,
        embeds: [embed]
    };

    await sendJson(buildWaitUrl(webhookUrl), payload);
    logger.info(`Proctor webhook sent: proctor=${proctor.id} applicant=${applicant.icName}`);
}

module.exports = {
    sendRegistration,
    editRegistrationMessage,
    fetchRegistrationMessage,
    sendMedical,
    editMedicalMessage,
    fetchMedicalMessage,
    sendProctorWebhook
};
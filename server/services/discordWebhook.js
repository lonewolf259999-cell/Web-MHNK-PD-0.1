/* ========================================
   Discord Webhook Service (Unified)
   - ส่งข้อมูลไปยัง Discord Webhook ทั้งแบบมีรูปและไม่มีรูป
   - ใช้ร่วมกันทั้ง register และ proctor
   ======================================== */

const https = require('https');
const http = require('http');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('DiscordWebhook');

/**
 * ส่ง Webhook แบบ JSON
 */
function sendJson(url, payload) {
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
            },
            timeout: config.REQUEST_TIMEOUT
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
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Webhook request timeout'));
        });
        req.write(data);
        req.end();
    });
}

/**
 * ส่ง Webhook พร้อมรูปภาพ (multipart/form-data)
 */
function sendMultipart(url, embed, base64Image, discordId) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);

        // แยก base64 data
        const base64Data = base64Image.split(',')[1];
        const contentType = base64Image.split(';')[0].split(':')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // สร้าง boundary สำหรับ multipart
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

        // สร้าง multipart body
        const jsonPart = JSON.stringify({
            content: discordId ? `<@${discordId}>` : undefined,
            embeds: [embed]
        });

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
            },
            timeout: config.REQUEST_TIMEOUT
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
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Webhook request timeout'));
        });
        req.write(body);
        req.end();
    });
}

/**
 * ส่งข้อมูลสมัครไปยัง Discord Webhook (Register)
 * @param {Object} registrationData - ข้อมูลการสมัคร
 * @returns {Promise<Object>} - ผลลัพธ์การส่ง
 */
async function sendRegistration(registrationData) {
    const { ocName, icName, ocAge, icPhone, discordId, steamUrl } = registrationData;

    // ตรวจสอบว่า discordId เป็นตัวเลข (User ID) หรือไม่
    const isNumericId = /^\d+$/.test(discordId);
    const discordMention = isNumericId ? `<@${discordId}>` : discordId || 'ไม่ระบุ';
    const discordDisplay = isNumericId ? discordMention : discordId || 'ไม่ระบุ';

    const embed = {
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
        footer: { text: 'MHNK Police Department • ระบบสมัครอัตโนมัติ' },
        timestamp: new Date().toISOString()
    };

    const payload = {
        content: discordMention !== 'ไม่ระบุ' ? discordMention : undefined,
        embeds: [embed]
    };

    const webhookUrl = config.DISCORD_REGISTER_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.error('Discord Register Webhook URL is not configured');
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับการสมัคร');
    }

    await sendJson(webhookUrl, payload);
    logger.info(`Registration sent: ${ocName} (${discordId})`);
    return { success: true, message: 'ส่งข้อมูลสำเร็จ' };
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
        await sendMultipart(webhookUrl, embed, image, discordId);
    } else {
        await sendJson(webhookUrl, { content: `<@${discordId}>`, embeds: [embed] });
    }

    logger.info(`Proctor record submitted: ${examineeName} by ${proctorName}`);
    return { success: true, message: 'บันทึกสำเร็จ' };
}

/**
 * ส่ง Webhook พร้อมหลายรูปและหลาย embeds (multipart/form-data)
 * สำหรับ Council โดยเฉพาะ ส่ง embed หลัก + รูป embed(s)
 */
function sendCouncilMultipart(url, mainEmbed, imageEmbeds, base64Image1, base64Image2, discordId) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);

        // รวม embeds ทั้งหมด
        const allEmbeds = [mainEmbed, ...imageEmbeds];

        // เตรียมข้อมูล multipart
        const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
        const payloadJson = JSON.stringify({
            content: discordId ? `<@${discordId}>` : undefined,
            embeds: allEmbeds
        });

        const parts = [];
        
        // ส่วน payload_json
        parts.push(`--${boundary}`);
        parts.push('Content-Disposition: form-data; name="payload_json"');
        parts.push('Content-Type: application/json');
        parts.push('');
        parts.push(payloadJson);

        // ส่วนไฟล์รูปที่ 1
        if (base64Image1) {
            const data1 = base64Image1.split(',')[1];
            const contentType1 = base64Image1.split(';')[0].split(':')[1];
            const buffer1 = Buffer.from(data1, 'base64');
            parts.push(`--${boundary}`);
            parts.push(`Content-Disposition: form-data; name="files[0]"; filename="image1.png"`);
            parts.push(`Content-Type: ${contentType1}`);
            parts.push('');
            parts.push('__FILE1_BINARY__');
        }

        // ส่วนไฟล์รูปที่ 2
        if (base64Image2) {
            const data2 = base64Image2.split(',')[1];
            const contentType2 = base64Image2.split(';')[0].split(':')[1];
            const buffer2 = Buffer.from(data2, 'base64');
            parts.push(`--${boundary}`);
            parts.push(`Content-Disposition: form-data; name="files[1]"; filename="image2.png"`);
            parts.push(`Content-Type: ${contentType2}`);
            parts.push('');
            parts.push('__FILE2_BINARY__');
        }

        parts.push(`--${boundary}--`);
        
        // แทนที่ placeholders ด้วย binary data จริง
        const headerStr = parts.join('\r\n');
        const headerStrBeforeFile1 = headerStr.substring(0, headerStr.indexOf('__FILE1_BINARY__'));
        const afterFile1ToFile2 = headerStr.substring(
            headerStr.indexOf('__FILE1_BINARY__') + '__FILE1_BINARY__'.length,
            headerStr.indexOf('__FILE2_BINARY__')
        );
        const afterFile2Str = headerStr.substring(
            headerStr.indexOf('__FILE2_BINARY__') + '__FILE2_BINARY__'.length
        );

        const chunks = [];
        chunks.push(Buffer.from(headerStrBeforeFile1, 'utf-8'));
        
        if (base64Image1) {
            const buffer1 = Buffer.from(base64Image1.split(',')[1], 'base64');
            chunks.push(buffer1);
        }
        
        chunks.push(Buffer.from(afterFile1ToFile2, 'utf-8'));
        
        if (base64Image2) {
            const buffer2 = Buffer.from(base64Image2.split(',')[1], 'base64');
            chunks.push(buffer2);
        }
        
        chunks.push(Buffer.from(afterFile2Str, 'utf-8'));

        const body = Buffer.concat(chunks);

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
                    resolve(responseBody);
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
        image1, image2
    } = councilData;

    const formatNumber = (num) => {
        return Number(num).toLocaleString('en-US');
    };

    // ใช้ Discord embed fields เพื่อจัดตารางให้สวยงาม
    const fields = [
        { name: '⚔️ สัญญาสตอรี ระหว่าง', value: `GANG — ${gangA} 🟣 VS 🔴 FAMILY — ${gangB}`, inline: false },
        { name: '\u200B', value: '\u200B', inline: false }, // spacer
        { name: '🟣 SLOT ฝั่ง A', value: `**${gangA}**\n\`${formatNumber(slotA)} SLOT\``, inline: true },
        { name: '🔴 SLOT ฝั่ง B', value: `**${gangB}**\n\`${formatNumber(slotB)} SLOT\``, inline: true },
        { name: '\u200B', value: '\u200B', inline: true }, // spacer
        { name: '\u200B', value: '\u200B', inline: false }, // spacer
        { name: '💰 มูลค่าสินเดิมพันรวม', value: `\`${formatNumber(betAmount)} IC\``, inline: true },
        { name: '⚡ จำนวนไฟต์', value: `\`${fightCount} ไฟต์\``, inline: true },
        { name: '📍 สถานที่', value: `\`${location}\``, inline: true },
        { name: '\u200B', value: '\u200B', inline: false }, // spacer
        { name: '📅 วันที่', value: `\`${dateStart} → ${dateEnd}\``, inline: true },
        { name: '🕐 เวลาเริ่มไฟต์แรก', value: `\`${startTime} น.\``, inline: true },
        { name: '🎮 เล่นกิจกรรมก่อนเริ่ม', value: `\`${preEventActivity}\``, inline: true },
        { name: '\u200B', value: '\u200B', inline: false }, // spacer
        { name: '👕 ชุดที่ใส่', value: `🟣 **${gangA}** : \`${outfitA}\`\n🔴 **${gangB}** : \`${outfitB}\``, inline: false },
        { name: '\u200B', value: '\u200B', inline: false }, // spacer
        { name: '📋 กติกาการบลัฟ', value: bluffRules || 'การบลัฟ • 100% (พิมเอง)', inline: false },
    ];

    // เพิ่มหมายเหตุถ้ามี
    if (notes && notes.trim()) {
        fields.push({ name: '📝 หมายเหตุ', value: notes.trim(), inline: false });
    }

    const discordName = councilData.discordName || '';
    const mainEmbed = {
        title: '📜 สัญญาสตอรี',
        description: discordName ? `👤 ผู้ดำเนินการ : **${discordName}**` : undefined,
        fields: fields,
        color: 0x9b59b6, // สีม่วง
        footer: { text: 'MHNK Police Department • สัญญาสตอรี' },
        timestamp: new Date().toISOString()
    };

    const webhookUrl = config.DISCORD_COUNCIL_WEBHOOK_URL;
    if (!webhookUrl) {
        logger.error('Discord Council Webhook URL is not configured');
        throw new Error('ระบบยังไม่ได้ตั้งค่า Webhook สำหรับสัญญาสตอรี');
    }

    const hasImage1 = !!image1;
    const hasImage2 = !!image2;

    if (hasImage1 || hasImage2) {
        // สร้าง image embeds (ใช้ thumbnail เพื่อให้เล็กลง, แสดงซ้าย-ขวา)
        const imageEmbeds = [];
        if (hasImage1) {
            imageEmbeds.push({
                title: '\u200B',
                color: 0x9b59b6,
                image: { url: 'attachment://image1.png' },
                footer: { text: '📷 รูปที่ 1' }
            });
        }
        if (hasImage2) {
            imageEmbeds.push({
                title: '\u200B',
                color: 0x9b59b6,
                image: { url: 'attachment://image2.png' },
                footer: { text: '📷 รูปที่ 2' }
            });
        }
        // ส่ง message เดียว: @mention + main embed + image embed(s)
        await sendCouncilMultipart(webhookUrl, mainEmbed, imageEmbeds, hasImage1 ? image1 : null, hasImage2 ? image2 : null, discordId);
    } else {
        const payload = { content: `<@${discordId}>`, embeds: [mainEmbed] };
        await sendJson(webhookUrl, payload);
    }

    logger.info(`Council record submitted: ${gangA} vs ${gangB}`);
    return { success: true, message: 'บันทึกสำเร็จ' };
}

module.exports = { sendRegistration, sendProctor, sendCouncil };

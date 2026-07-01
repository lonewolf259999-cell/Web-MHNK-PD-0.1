/* ========================================
   Roster Management Service
   - อ่าน NamePD / OutDC
   - ย้ายสมาชิกจาก NamePD → OutDC
   ======================================== */

const https = require('https');
const { getSheets } = require('../config/googleAuth');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Roster');

/**
 * ส่ง WebHook แจ้งเตือนไปยังห้อง Discord
 */
function sendWebhook(reason, discordId) {
    return new Promise((resolve) => {
        const webhookUrl = config.DISCORD_OUTPD_WEBHOOK_URL;
        if (!webhookUrl) {
            logger.warn('WebHook', 'ไม่ได้ตั้งค่า DISCORD_OUTPD_WEBHOOK_URL');
            resolve({ success: false });
            return;
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('th-TH', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });

        const reasonLabel = reason === 'ถูกปลดออก' ? 'ถูกปลดออก' : 'ลาออก';

        // นอก Embed: mention Discord user
        const content = `<@${discordId}>`;

        const embed = {
            title: '📢 ประกาศลาออกจากการเป็นเจ้าหน้าที่',
            description: `ต่อจากนี้ คุณ <@${discordId}> ได้${reasonLabel}จากการเป็นเจ้าหน้าที่\nต่อจากนี้การกระทำใดๆก็แล้วแต่จะไม่ข้องเกี่ยวกับ สน อีกต่อไป\n\nณ วันที่ ${dateStr}\n\nขอบคุณสำหรับการทำงานที่ผ่านมา\n@DEKMHNK DIWA`,
            color: reason === 'ถูกปลดออก' ? 0xef4444 : 0x3b82f6,
            timestamp: now.toISOString(),
        };

        const body = JSON.stringify({ content, embeds: [embed] });

        const urlObj = new URL(webhookUrl);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = https.request(options, (res) => {
            let resp = '';
            res.on('data', chunk => resp += chunk);
            res.on('end', () => resolve({ success: res.statusCode === 204, status: res.statusCode }));
        });
        req.on('error', (err) => {
            logger.error('WebHook', `ส่ง WebHook ล้มเหลว: ${err.message}`);
            resolve({ success: false, error: err.message });
        });
        req.write(body);
        req.end();
    });
}

/**
 * อ่านรายชื่อทั้งหมดจาก NamePD (คอลัมน์ C ถึง N)
 * C=รหัส, D=ชื่อ, E=Discord ID, F=ยศ, G=เคส, H=วันที่เริ่ม
 * I=จำนวนวัน, J=ออกเวรล่าสุด, K=เวลา, L=ระยะเวลา, M=Steam, N=สถานะ
 */
async function getNamePDMembers() {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.ROSTER_SHEET_ID,
        range: `${config.ROSTER_SHEET_NAME}!C:N`,
    });
    const rows = response.data.values || [];
    const members = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const code = (row[0] || '').trim();
        if (!code || code.length > 3 || !/^\d+$/.test(code)) continue;
        const name = (row[1] || '').trim();
        if (!name) continue;
        members.push({
            row: i + 1,
            code,
            name,
            discordId: (row[2] || '').trim(),
            rank: (row[3] || '').trim(),
            cases: (row[4] || '').trim(),
            startDate: (row[5] || '').trim(),
            days: (row[6] || '').trim(),
            lastDuty: (row[7] || '').trim(),
            lastTime: (row[8] || '').trim(),
            duration: (row[9] || '').trim(),
            steam: (row[10] || '').trim(),
            status: (row[11] || '').trim(),
        });
    }
    return members;
}

/**
 * อ่านรายชื่อจาก OutDC (คอลัมน์ C ถึง N)
 */
async function getOutDCMembers() {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.ROSTER_SHEET_ID,
        range: `${config.ROSTER_OUT_SHEET_NAME}!C:N`,
    });
    const rows = response.data.values || [];
    const members = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const code = (row[0] || '').trim();
        if (!code || code.length > 3 || !/^\d+$/.test(code)) continue;
        const name = (row[1] || '').trim();
        if (!name) continue;
        members.push({
            row: i + 1,
            code,
            name,
            discordId: (row[2] || '').trim(),
            rank: (row[3] || '').trim(),
            cases: (row[4] || '').trim(),
            startDate: (row[5] || '').trim(),
            days: (row[6] || '').trim(),
            lastDuty: (row[7] || '').trim(),
            lastTime: (row[8] || '').trim(),
            noDuty: (row[9] || '').trim(),
            steam: (row[10] || '').trim(),
            reason: (row[11] || '').trim(),
        });
    }
    return members;
}

/**
 * อัปเดตสถานะใน NamePD คอลัมน์ N
 */
async function updateStatus(row, status) {
    const sheets = getSheets();
    await sheets.spreadsheets.values.update({
        spreadsheetId: config.ROSTER_SHEET_ID,
        range: `${config.ROSTER_SHEET_NAME}!N${row}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[status]] },
    });
    logger.info(`อัปเดตสถานะ: แถว ${row} = ${status}`);
}

/**
 * ย้ายสมาชิกจาก NamePD ไป OutDC
 * - ลบ NamePD: D, E, H, J, K, M, N, O-U (คง C=code, F=ยศ, G=เคส, I=วัน, L=ระยะเวลา)
 * - เพิ่ม OutDC: C ถึง N
 */
async function moveToOutDC(row, reason) {
    const sheets = getSheets();

    const namepdRes = await sheets.spreadsheets.values.get({
        spreadsheetId: config.ROSTER_SHEET_ID,
        range: `${config.ROSTER_SHEET_NAME}!C${row}:N${row}`,
    });
    const namepdRow = namepdRes.data.values?.[0];
    if (!namepdRow || namepdRow.length < 12) {
        throw new Error('ไม่พบข้อมูลแถวนี้ใน NamePD');
    }

    const code = namepdRow[0];
    const name = namepdRow[1];
    const discordId = namepdRow[2];
    const rank = namepdRow[3];
    const cases = namepdRow[4];
    const startDate = namepdRow[5];
    const days = namepdRow[6];
    const lastDuty = namepdRow[7];
    const lastTime = namepdRow[8];
    const duration = namepdRow[9];
    const steam = namepdRow[10];

    const outRes = await sheets.spreadsheets.values.get({
        spreadsheetId: config.ROSTER_SHEET_ID,
        range: `${config.ROSTER_OUT_SHEET_NAME}!C:C`,
    });
    const outRows = outRes.data.values || [];
    let nextRow = outRows.length + 1;
    if (nextRow < 3) nextRow = 3;

    await sheets.spreadsheets.values.update({
        spreadsheetId: config.ROSTER_SHEET_ID,
        range: `${config.ROSTER_OUT_SHEET_NAME}!C${nextRow}:N${nextRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [[
                code, name, discordId, rank, cases,
                startDate, days, lastDuty, lastTime,
                duration, steam, reason
            ]]
        },
    });

    const clearCols = ['D', 'E', 'G', 'H', 'J', 'K', 'M', 'N'];
    for (let c = 15; c <= 21; c++) {
        clearCols.push(String.fromCharCode(64 + c));
    }
    for (const col of clearCols) {
        await sheets.spreadsheets.values.update({
            spreadsheetId: config.ROSTER_SHEET_ID,
            range: `${config.ROSTER_SHEET_NAME}!${col}${row}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [['']] },
        });
    }

    logger.info(`ย้ายออก: ${code} ${name} → OutDC แถว ${nextRow} (${reason})`);
    return { code, name, discordId, outRow: nextRow };
}

module.exports = {
    getNamePDMembers,
    getOutDCMembers,
    updateStatus,
    moveToOutDC,
    sendWebhook,
};

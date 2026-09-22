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

        const body = JSON.stringify({
            content: `<@${discordId}>`,
            embeds: [{
                title: '📢 ประกาศลาออกจากการเป็นเจ้าหน้าที่',
                description: `ต่อจากนี้ คุณ <@${discordId}> ได้${reasonLabel}จากการเป็นเจ้าหน้าที่\nต่อจากนี้การกระทำใดๆก็แล้วแต่จะไม่ข้องเกี่ยวกับ สน อีกต่อไป\n\nณ วันที่ ${dateStr} (คูลดาวน์ 1 วัน)\n\nขอบคุณสำหรับการทำงานที่ผ่านมา`,
                color: reason === 'ถูกปลดออก' ? 0xef4444 : 0x3b82f6,
                timestamp: now.toISOString(),
            }],
        });

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
 * อ่านรายชื่อทั้งหมดจาก NamePD (คอลัมน์ B ถึง N)
 * B=เบอร์, C=รหัส, D=ชื่อ, E=Discord ID, F=ยศ, G=เคส, H=วันที่เริ่ม
 * I=จำนวนวัน, J=ออกเวรล่าสุด, K=เวลา, L=ระยะเวลา, M=Steam, N=สถานะ
 */
async function getNamePDMembers() {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.ROSTER_SHEET_ID,
        range: `${config.ROSTER_SHEET_NAME}!B:N`,
    });
    const rows = response.data.values || [];
    const members = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const phone = (row[0] || '').trim();
        const code = (row[1] || '').trim();
        if (!code || code.length > 3 || !/^\d+$/.test(code)) continue;
        const name = (row[2] || '').trim();
        if (!name) continue;
        members.push({
            row: i + 1,
            code,
            name,
            phone,
            discordId: (row[3] || '').trim(),
            rank: (row[4] || '').trim(),
            cases: (row[5] || '').trim(),
            startDate: (row[6] || '').trim(),
            days: (row[7] || '').trim(),
            lastDuty: (row[8] || '').trim(),
            lastTime: (row[9] || '').trim(),
            duration: (row[10] || '').trim(),
            steam: (row[11] || '').trim(),
            status: (row[12] || '').trim(),
        });
    }
    return members;
}

/**
 * อ่านรายชื่อจาก OutDC (คอลัมน์ B ถึง N)
 * B=เบอร์, C=รหัส, D=ชื่อ, E=Discord ID, F=ยศ, G=เคส, H=วันที่เริ่ม
 * I=จำนวนวัน, J=ออกเวรล่าสุด, K=เวลา, L=ระยะเวลา, M=Steam, N=สาเหตุ
 */
async function getOutDCMembers() {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.ROSTER_SHEET_ID,
        range: `${config.ROSTER_OUT_SHEET_NAME}!B:N`,
    });
    const rows = response.data.values || [];
    const members = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const phone = (row[0] || '').trim();
        const code = (row[1] || '').trim();
        if (!code || code.length > 3 || !/^\d+$/.test(code)) continue;
        const name = (row[2] || '').trim();
        if (!name) continue;
        members.push({
            row: i + 1,
            code,
            name,
            phone,
            discordId: (row[3] || '').trim(),
            rank: (row[4] || '').trim(),
            cases: (row[5] || '').trim(),
            startDate: (row[6] || '').trim(),
            days: (row[7] || '').trim(),
            lastDuty: (row[8] || '').trim(),
            lastTime: (row[9] || '').trim(),
            noDuty: (row[10] || '').trim(),
            steam: (row[11] || '').trim(),
            reason: (row[12] || '').trim(),
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
 * หาแถวว่างแรกใน OutDC ตั้งแต่แถว 3 ขึ้นไป
 * ใช้คอลัมน์ D (ชื่อ) เป็นตัวตรวจสอบ
 * รองรับกรณีที่มีแถวว่างแทรกตรงกลาง
 */
async function _findEmptyOutDCRow(sheets) {
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: config.ROSTER_SHEET_ID,
        range: `${config.ROSTER_OUT_SHEET_NAME}!D3:D`,
        valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = res.data.values || [];
    // rows[0] = D3, rows[1] = D4, ... index 0 = แถว 3
    for (let i = 0; i < rows.length; i++) {
        if (!rows[i][0] || !rows[i][0].trim()) {
            return 3 + i;
        }
    }
    // ไม่เจอแถวว่าง → ต่อท้าย
    return 3 + rows.length;
}

/**
 * ย้ายสมาชิกจาก NamePD ไป OutDC พร้อมส่ง WebHook
 * - อ่านข้อมูล NamePD แถวนั้น (B ถึง N) รวมเบอร์
 * - เขียนไป OutDC (B ถึง N)
 * - ลบ NamePD: B, D, E, G, H, J, K, M, N, O-U (คง C=รหัส, F=ยศ, I=วัน, L=ระยะเวลา)
 * - อ่านสาเหตุจากคอลัมน์ N (สถานะ) ใน NamePD
 */
async function moveToOutDC(row, reason) {
    const sheets = getSheets();

    // อ่าน B ถึง N เพื่อเอาเบอร์ด้วย
    const namepdRes = await sheets.spreadsheets.values.get({
        spreadsheetId: config.ROSTER_SHEET_ID,
        range: `${config.ROSTER_SHEET_NAME}!B${row}:N${row}`,
    });
    const namepdRow = namepdRes.data.values?.[0];
    if (!namepdRow || namepdRow.length < 13) {
        throw new Error('ไม่พบข้อมูลแถวนี้ใน NamePD');
    }

    const phone = namepdRow[0];
    const code = namepdRow[1];
    const name = namepdRow[2];
    const discordId = namepdRow[3];
    const rank = namepdRow[4];
    const cases = namepdRow[5];
    const startDate = namepdRow[6];
    const days = namepdRow[7];
    const lastDuty = namepdRow[8];
    const lastTime = namepdRow[9];
    const duration = namepdRow[10];
    const steam = namepdRow[11];
    const status = namepdRow[12];

    // ใช้สาเหตุจาก status ใน N ก่อน ถ้าไม่มีค่อยใช้ reason ที่ส่งมา
    const finalReason = status || reason;

    // หาแถวว่างแรกใน OutDC ตั้งแต่แถว 3 โดยใช้คอลัมน์ D (ชื่อ)
    const nextRow = await _findEmptyOutDCRow(sheets);

    // เขียนไป OutDC (B ถึง N)
    await sheets.spreadsheets.values.update({
        spreadsheetId: config.ROSTER_SHEET_ID,
        range: `${config.ROSTER_OUT_SHEET_NAME}!B${nextRow}:N${nextRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
            values: [[
                phone, code, name, discordId, rank, cases,
                startDate, days, lastDuty, lastTime,
                duration, steam, finalReason
            ]],
        },
    });

    // ลบ NamePD: B, D, E, G, H, J, K, M, N, O-U (15-21)
    const clearCols = ['B', 'D', 'E', 'G', 'H', 'J', 'K', 'M', 'N'];
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

    logger.info(`ย้ายออก: ${code} ${name} → OutDC แถว ${nextRow} (${finalReason})`);
    return { code, name, discordId };
}

module.exports = {
    getNamePDMembers,
    getOutDCMembers,
    updateStatus,
    moveToOutDC,
    sendWebhook,
};

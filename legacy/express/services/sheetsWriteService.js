/* ========================================
   Sheets Write Service
   - เขียนข้อมูลลง Google Sheets สำหรับ Pending registration
   - ใช้ googleAuth.js singleton
   ======================================== */

const { getSheets } = require('../config/googleAuth');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('SheetsWrite');

/**
 * เขียนข้อมูลสมัครใหม่ลงชีต Pending
 * @param {Object} data - { discordId, discordName, icName, icPhone, ocAge, steamUrl }
 */
async function addPendingRegistration(data) {
    const sheets = getSheets();
    const { discordId, discordName, icName, icPhone, ocAge, steamUrl } = data;
    const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

    const row = [
        timestamp,
        discordId,
        discordName || '',
        icName,
        icPhone,
        String(ocAge),
        steamUrl,
        'รอตรวจ'  // สถานะเริ่มต้น
    ];

    await sheets.spreadsheets.values.append({
        spreadsheetId: config.PENDING_SPREADSHEET_ID,
        range: `${config.PENDING_SHEET_NAME}!A:H`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
    });

    logger.info(`เพิ่มข้อมูลลง Pending: ${discordId} (${icName})`);
}

/**
 * อ่านข้อมูลทั้งหมดจากชีต Pending
 * @returns {Array<Object>} รายการที่รออนุมัติ
 */
async function getPendingRegistrations() {
    const sheets = getSheets();
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.PENDING_SPREADSHEET_ID,
        range: `${config.PENDING_SHEET_NAME}!A:H`,
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return []; // มีแค่ header

    const headers = rows[0] || [];
    const items = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = (row[idx] || '').trim(); });
        obj._row = i + 1; // 1-based row number
        items.push(obj);
    }

    return items;
}

/**
 * อนุมัติ: อัปเดตสถานะจาก "รอตรวจ" → "อนุมัติ"
 * @param {number} rowNumber - แถวในชีต (1-based)
 */
async function approvePendingRegistration(rowNumber) {
    const sheets = getSheets();
    await sheets.spreadsheets.values.update({
        spreadsheetId: config.PENDING_SPREADSHEET_ID,
        range: `${config.PENDING_SHEET_NAME}!H${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['อนุมัติ']] },
    });
    logger.info(`อนุมัติ: แถว ${rowNumber}`);
}

/**
 * อัปเดตข้อมูลใน Pending Sheet (เมื่อผู้ใช้แก้ไขข้อมูล) โดยค้นจาก Discord ID
 * @param {string} discordId - Discord ID ของผู้ใช้
 * @param {Object} data - { icName, icPhone, ocAge, steamUrl }
 */
async function updatePendingRegistration(discordId, data) {
    const sheets = getSheets();
    const { icName, icPhone, ocAge, steamUrl } = data;

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.PENDING_SPREADSHEET_ID,
        range: `${config.PENDING_SHEET_NAME}!A:H`,
    });

    const rows = response.data.values || [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const pendingId = (row[1] || '').trim(); // Column B = Discord ID
        if (pendingId === discordId) {
            const rowNum = i + 1; // 1-based
            await sheets.spreadsheets.values.update({
                spreadsheetId: config.PENDING_SPREADSHEET_ID,
                range: `${config.PENDING_SHEET_NAME}!D${rowNum}:G${rowNum}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [[icName, icPhone, String(ocAge), steamUrl]] },
            });
            logger.info(`อัปเดต Pending: ${discordId} (IC: ${icName}) แถว ${rowNum}`);
            return;
        }
    }
    // ถ้าไม่เจอ Discord ID ใน Pending (อาจอนุมัติไปแล้ว) — ไม่ต้องทำอะไร
    logger.warn(`อัปเดต Pending: ไม่พบ ${discordId} ใน Pending Sheet (อาจอนุมัติไปแล้ว)`);
}

/**
 * ปฏิเสธ: อัปเดตสถานะ → "ปฏิเสธ"
 * @param {number} rowNumber - แถวในชีต (1-based)
 */
async function rejectPendingRegistration(rowNumber) {
    const sheets = getSheets();
    await sheets.spreadsheets.values.update({
        spreadsheetId: config.PENDING_SPREADSHEET_ID,
        range: `${config.PENDING_SHEET_NAME}!H${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['ปฏิเสธ']] },
    });
    logger.info(`ปฏิเสธ: แถว ${rowNumber}`);
}

module.exports = {
    addPendingRegistration,
    getPendingRegistrations,
    approvePendingRegistration,
    rejectPendingRegistration,
    updatePendingRegistration,
};

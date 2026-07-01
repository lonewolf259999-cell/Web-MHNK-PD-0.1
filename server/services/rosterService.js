/* ========================================
   Roster Management Service
   - อ่าน NamePD / OutDC
   - ย้ายสมาชิกจาก NamePD → OutDC
   ======================================== */

const { getSheets } = require('../config/googleAuth');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Roster');

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
    for (let i = 1; i < rows.length; i++) { // ข้ามแถว header (index 0)
        const row = rows[i];
        const code = (row[0] || '').trim();
        if (!code || code.length > 3 || !/^\d+$/.test(code)) continue;
        const name = (row[1] || '').trim();
        if (!name) continue;
        members.push({
            row: i + 1, // 1-based
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
 * C=รหัส, D=ชื่อ, E=Discord ID, F=ยศ, G=เคส, H=วันที่เริ่ม
 * I=จำนวนวัน, J=ออกเวรล่าสุด, K=เวลา, L=ไม่เข้าเวร, M=Steam, N=เหตุผล
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
 * อัปเดตสถานะใน NamePD คอลัมน์ N (index 11 ใน range C:N)
 * @param {number} row - 1-based row number
 * @param {string} status - "ออกจาก Discord", "ถูกปลดออก", "ติดต่อขอออก"
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
 * @param {number} row - 1-based row ใน NamePD
 * @param {string} reason - สาเหตุที่ย้ายออก
 */
async function moveToOutDC(row, reason) {
    const sheets = getSheets();

    // 1. อ่านข้อมูล C-N จาก NamePD
    const namepdRes = await sheets.spreadsheets.values.get({
        spreadsheetId: config.ROSTER_SHEET_ID,
        range: `${config.ROSTER_SHEET_NAME}!C${row}:N${row}`,
    });
    const namepdRow = namepdRes.data.values?.[0];
    if (!namepdRow || namepdRow.length < 12) {
        throw new Error('ไม่พบข้อมูลแถวนี้ใน NamePD');
    }

    // C(0) D(1) E(2) F(3) G(4) H(5) I(6) J(7) K(8) L(9) M(10) N(11)
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

    // 2. หาแถวว่างใน OutDC
    const outRes = await sheets.spreadsheets.values.get({
        spreadsheetId: config.ROSTER_SHEET_ID,
        range: `${config.ROSTER_OUT_SHEET_NAME}!C:C`,
    });
    const outRows = outRes.data.values || [];
    let nextRow = outRows.length + 1;
    if (nextRow < 3) nextRow = 3; // Row 1=header, Row 2=data start

    // 3. เขียน C-N ไป OutDC (C=code, D=name, E=discordId, F=rank, G=cases,
    //    H=startDate, I=days, J=lastDuty, K=lastTime, L=duration, M=steam, N=reason)
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

    // 4. ลบข้อมูลใน NamePD
    //    D(1)='' ลบชื่อ, E(2)='' ลบDiscord ID, H(5)='' ลบวันที่เริ่ม
    //    J(7)='' ลบออกเวรล่าสุด, K(8)='' ลบเวลา, M(10)='' ลบsteam
    //    N(11)='' ลบสถานะ
    //    O-U = คอลัมน์ 14-20 (index 1-based) = ลบทั้งหมด
    const clearCols = [
        { col: 'D', val: '' },   // ชื่อ
        { col: 'E', val: '' },   // Discord ID
        { col: 'H', val: '' },   // วันที่เริ่ม
        { col: 'J', val: '' },   // ออกเวรล่าสุด
        { col: 'K', val: '' },   // เวลา
        { col: 'M', val: '' },   // Steam
        { col: 'N', val: '' },   // สถานะ
    ];

    // เคลียร์ O-U (คอลัมน์ 15-21)
    for (let c = 15; c <= 21; c++) {
        const colLetter = String.fromCharCode(64 + c); // O=79, P=80, Q=81, R=82, S=83, T=84, U=85
        clearCols.push({ col: colLetter, val: '' });
    }

    for (const item of clearCols) {
        await sheets.spreadsheets.values.update({
            spreadsheetId: config.ROSTER_SHEET_ID,
            range: `${config.ROSTER_SHEET_NAME}!${item.col}${row}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[item.val]] },
        });
    }

    logger.info(`ย้ายออก: ${code} ${name} → OutDC แถว ${nextRow} (${reason})`);
    return { code, name, outRow: nextRow };
}

module.exports = {
    getNamePDMembers,
    getOutDCMembers,
    updateStatus,
    moveToOutDC,
};
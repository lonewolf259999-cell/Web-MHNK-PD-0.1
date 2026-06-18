/* ========================================
   Controller - Pending Registration Admin
   - GET /api/pending → ดูรายการที่รออนุมัติ
   - POST /api/pending/approve/:row → อนุมัติ
   - POST /api/pending/reject/:row → ปฏิเสธ
   ======================================== */

const { getPendingRegistrations, approvePendingRegistration, rejectPendingRegistration } = require('../services/sheetsWriteService');
const { sendProctorWebhook } = require('../services/discordWebhook');
const { createLogger } = require('../utils/logger');

const logger = createLogger('PendingController');

/**
 * GET /api/pending
 * ดูรายการทั้งหมดที่รออนุมัติ
 */
async function listPending(req, res) {
    const items = await getPendingRegistrations();
    res.json({ success: true, data: items });
}

/**
 * POST /api/pending/approve/:row
 * อนุมัติ (เปลี่ยนสถานะเป็น "อนุมัติ") + ส่ง Webhook แจ้ง Proctor
 */
async function approve(req, res) {
    const row = parseInt(req.params.row, 10);
    if (!row || row < 1) {
        return res.status(400).json({ success: false, message: 'ระบุหมายเลขแถวไม่ถูกต้อง' });
    }

    const proctorId = req.body.proctorDiscordId || '';
    const proctorName = req.body.proctorDiscordName || '';

    if (!proctorId) {
        return res.status(400).json({ success: false, message: 'กรุณาเชื่อมต่อ Discord (Proctor) ก่อนอนุมัติ' });
    }

    // ดึงข้อมูลผู้สมัครเพื่อใช้ใน webhook
    const allItems = await getPendingRegistrations();
    const applicant = allItems.find(r => r._row === row);

    await approvePendingRegistration(row);

    // ส่ง webhook (ไม่ต้องรอผล ถ้าล้มเหลวไม่กระทบการอนุมัติ)
    if (applicant) {
        sendProctorWebhook(
            { id: proctorId, name: proctorName },
            { discordId: applicant['Discord ID'] || '', icName: applicant['ชื่อ IC'] || '' }
        ).catch(err => logger.error(`Proctor webhook failed: ${err.message}`));
    }

    logger.info(`Admin อนุมัติ: แถว ${row} โดย proctor ${proctorId}`);
    res.json({ success: true, message: 'อนุมัติเรียบร้อย' });
}

/**
 * POST /api/pending/reject/:row
 * ปฏิเสธ (เปลี่ยนสถานะเป็น "ปฏิเสธ")
 */
async function reject(req, res) {
    const row = parseInt(req.params.row, 10);
    if (!row || row < 1) {
        return res.status(400).json({ success: false, message: 'ระบุหมายเลขแถวไม่ถูกต้อง' });
    }
    await rejectPendingRegistration(row);
    logger.info(`Admin ปฏิเสธ: แถว ${row}`);
    res.json({ success: true, message: 'ปฏิเสธเรียบร้อย' });
}

module.exports = { listPending, approve, reject };
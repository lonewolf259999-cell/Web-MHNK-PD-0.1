/* ========================================
   Controller - Pending Registration Admin
   - GET /api/pending → ดูรายการที่รออนุมัติ
   - POST /api/pending/approve/:row → อนุมัติ
   - POST /api/pending/reject/:row → ปฏิเสธ
   ======================================== */

const { getPendingRegistrations, approvePendingRegistration, rejectPendingRegistration } = require('../services/sheetsWriteService');
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
 * อนุมัติ (เปลี่ยนสถานะเป็น "อนุมัติ")
 */
async function approve(req, res) {
    const row = parseInt(req.params.row, 10);
    if (!row || row < 1) {
        return res.status(400).json({ success: false, message: 'ระบุหมายเลขแถวไม่ถูกต้อง' });
    }
    await approvePendingRegistration(row);
    logger.info(`Admin อนุมัติ: แถว ${row}`);
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
/* ========================================
   Roster Management Controller
   ======================================== */

const rosterService = require('../services/rosterService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('RosterCtrl');

/**
 * GET /api/roster/namepd
 * ดึงรายชื่อทั้งหมดจาก NamePD
 */
async function getNamePD(req, res) {
    const members = await rosterService.getNamePDMembers();
    res.json({ success: true, data: members });
}

/**
 * GET /api/roster/outdc
 * ดึงรายชื่อทั้งหมดจาก OutDC
 */
async function getOutDC(req, res) {
    const members = await rosterService.getOutDCMembers();
    res.json({ success: true, data: members });
}

/**
 * PUT /api/roster/status/:row
 * อัปเดตสถานะใน NamePD (คอลัมน์ N)
 * Body: { status: "ออกจาก Discord" | "ถูกปลดออก" | "ติดต่อขอออก" }
 */
async function updateStatus(req, res) {
    const row = parseInt(req.params.row, 10);
    const { status } = req.body;
    if (!row || !status) {
        return res.status(400).json({ success: false, error: 'Missing row or status' });
    }
    const validStatuses = ['ออกจาก Discord', 'ถูกปลดออก', 'ติดต่อขอออก'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    await rosterService.updateStatus(row, status);
    logger.info(`อัปเดตสถานะ: แถว ${row} = ${status}`);
    res.json({ success: true, message: `อัปเดตสถานะเป็น "${status}" แล้ว` });
}

/**
 * POST /api/roster/move-out/:row
 * ย้ายสมาชิกจาก NamePD ไป OutDC
 * Body: { reason: "ออกจาก Discord" | "ถูกปลดออก" | "ติดต่อขอออก" }
 */
async function moveToOutDC(req, res) {
    const row = parseInt(req.params.row, 10);
    const { reason } = req.body;
    if (!row || !reason) {
        return res.status(400).json({ success: false, error: 'Missing row or reason' });
    }
    const validReasons = ['ออกจาก Discord', 'ถูกปลดออก', 'ติดต่อขอออก'];
    if (!validReasons.includes(reason)) {
        return res.status(400).json({ success: false, error: 'Invalid reason' });
    }
    try {
        const result = await rosterService.moveToOutDC(row, reason);
        logger.info(`ย้ายออก: ${result.code} ${result.name} → OutDC (${reason})`);
        res.json({ success: true, message: `ย้าย ${result.code} ${result.name} ออกแล้ว`, data: result });
    } catch (err) {
        logger.error(`ย้ายออกล้มเหลว: ${err.message}`);
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    getNamePD,
    getOutDC,
    updateStatus,
    moveToOutDC,
};
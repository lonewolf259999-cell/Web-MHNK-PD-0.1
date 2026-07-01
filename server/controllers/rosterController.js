/* ========================================
   Roster Management Controller
   ======================================== */

const rosterService = require('../services/rosterService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('RosterCtrl');

/**
 * POST /api/roster/namepd
 */
async function getNamePD(req, res) {
    const members = await rosterService.getNamePDMembers();
    res.json({ success: true, data: members });
}

/**
 * POST /api/roster/outdc
 */
async function getOutDC(req, res) {
    const members = await rosterService.getOutDCMembers();
    res.json({ success: true, data: members });
}

/**
 * PUT /api/roster/status/:row
 */
async function updateStatus(req, res) {
    const row = parseInt(req.params.row, 10);
    const { status } = req.body;
    if (!row || status === undefined || status === null) {
        return res.status(400).json({ success: false, error: 'Missing row or status' });
    }
    const validStatuses = ['', 'ออกจาก Discord', 'ถูกปลดออก', 'ติดต่อขอออก', 'เกิน 15 วัน'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    await rosterService.updateStatus(row, status);
    const displayStatus = status || '✅ ปกติ';
    logger.info(`อัปเดตสถานะ: แถว ${row} = ${displayStatus}`);
    res.json({ success: true, message: `อัปเดตสถานะเป็น "${displayStatus}" แล้ว` });
}

/**
 * POST /api/roster/move-out/:row
 * ย้ายสมาชิกจาก NamePD → OutDC + ส่ง WebHook (เฉพาะถูกปลดออก/ติดต่อขอออก)
 */
async function moveToOutDC(req, res) {
    const row = parseInt(req.params.row, 10);
    const { reason } = req.body;
    if (!row || !reason) {
        return res.status(400).json({ success: false, error: 'Missing row or reason' });
    }
    const validReasons = ['ออกจาก Discord', 'ถูกปลดออก', 'ติดต่อขอออก', 'เกิน 15 วัน'];
    if (!validReasons.includes(reason)) {
        return res.status(400).json({ success: false, error: 'Invalid reason' });
    }
    try {
        const result = await rosterService.moveToOutDC(row, reason);

        // ส่ง WebHook เฉพาะถูกปลดออก/ติดต่อขอออก
        const errors = [];
        if (reason === 'ถูกปลดออก' || reason === 'ติดต่อขอออก') {
            try {
                const discordId = result.discordId.replace(/[<@>]/g, '');
                if (discordId) {
                    const whRes = await rosterService.sendWebhook(reason, discordId);
                    if (!whRes.success) {
                        errors.push(`WebHook: ${whRes.error || 'status=' + whRes.status}`);
                    }
                }
            } catch (err) {
                errors.push(`WebHook error: ${err.message}`);
            }
        }

        const extraMsg = errors.length > 0 ? ' (⚠️ ' + errors.join('; ') + ')' : '';
        logger.info(`ย้ายออก: ${result.code} ${result.name} → OutDC (${reason})${extraMsg}`);
        res.json({
            success: true,
            message: `ย้าย ${result.code} ${result.name} ออกแล้ว${extraMsg}`,
            data: result,
            warnings: errors.length > 0 ? errors : undefined,
        });
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
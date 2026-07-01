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
 * ย้ายออกตามสถานะ
 * - "ออกจาก Discord" → moveToOutDC อย่างเดียว
 * - "ถูกปลดออก" → moveToOutDC + เตะ + WebHook
 * - "ติดต่อขอออก" → moveToOutDC + เตะ + WebHook
 * - "เกิน 15 วัน" → สลับบทบาท + moveToOutDC (ไม่เตะ, ไม่ WebHook)
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
        // 1. moveToOutDC ก่อนเสมอ
        const result = await rosterService.moveToOutDC(row, reason);

        // 2. แยก action ตาม reason
        const errors = [];

        if (reason === 'ถูกปลดออก' || reason === 'ติดต่อขอออก') {
            // เตะออกจาก Discord
            try {
                const userId = rosterService.extractUserId(result.discordId);
                if (userId) {
                    const kickRes = await rosterService.kickFromDiscord(userId);
                    if (!kickRes.success) {
                        errors.push(`เตะ Discord ล้มเหลว: ${kickRes.error || 'ไม่ทราบสาเหตุ'}`);
                    }
                }
            } catch (err) {
                errors.push(`เตะ Discord error: ${err.message}`);
            }

            // ส่ง WebHook
            try {
                const webhookRes = await rosterService.sendWebhook(reason, result.code, result.name, result.discordId);
                if (!webhookRes.success) {
                    errors.push(`ส่ง WebHook ล้มเหลว: ${webhookRes.error || 'status=' + webhookRes.status}`);
                }
            } catch (err) {
                errors.push(`WebHook error: ${err.message}`);
            }
        }

        if (reason === 'เกิน 15 วัน') {
            // สลับบทบาท
            try {
                const userId = rosterService.extractUserId(result.discordId);
                if (userId) {
                    const swapRes = await rosterService.swapRoles15Day(userId);
                    if (!swapRes.success) {
                        errors.push(`สลับบทบาทล้มเหลว: ${swapRes.error || 'ไม่ทราบสาเหตุ'}`);
                    }
                }
            } catch (err) {
                errors.push(`สลับบทบาท error: ${err.message}`);
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
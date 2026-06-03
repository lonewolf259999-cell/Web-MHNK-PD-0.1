/* ========================================
    Controller - Proctor endpoints
    ======================================== */

const config = require('../config');
const { sendProctor } = require('../services/discordWebhook');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ProctorController');

/**
 * ส่งค่า config ที่จำเป็นให้ frontend
 */
function getConfig(req, res) {
    res.json({
        webhookUrl: config.DISCORD_PROCTOR_WEBHOOK_URL,
        success: true
    });
}

/**
 * รับข้อมูลคุมสอบและส่งไปยัง Discord Webhook
 */
async function submitProctor(req, res) {
    try {
        const { proctorName, discordId, examineeName, examDate, image, notes } = req.body;

        // Validation
        if (!discordId) {
            return res.status(400).json({ success: false, error: 'กรุณาเชื่อมต่อ Discord ก่อนส่งข้อมูล' });
        }
        if (!examineeName || !examineeName.trim()) {
            return res.status(400).json({ success: false, error: 'กรุณากรอกชื่อผู้สอบ' });
        }
        if (!examDate) {
            return res.status(400).json({ success: false, error: 'กรุณาเลือกวันที่สอบ' });
        }

        // ส่งข้อมูลโดยใช้ Discord Webhook Service
        await sendProctor({
            proctorName: proctorName || 'ไม่ระบุ',
            discordId,
            examineeName,
            examDate,
            notes,
            image
        });

        logger.info(`Proctor record submitted: ${examineeName} by ${proctorName}`);
        res.json({ success: true, message: 'บันทึกสำเร็จ' });

    } catch (err) {
        logger.error(`Proctor submit error: ${err.message}`);
        res.status(500).json({ success: false, error: err.message || 'ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง' });
    }
}

module.exports = {
    getConfig,
    submitProctor
};
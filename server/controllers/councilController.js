/* ========================================
    Controller - Council (สัญญาสตอรี) endpoints
    ======================================== */

const { sendCouncil } = require('../services/discordWebhook');
const { createLogger } = require('../utils/logger');

const logger = createLogger('CouncilController');

/**
 * รับข้อมูลสัญญาสตอรีและส่งไปยัง Discord Webhook
 */
async function submitCouncil(req, res) {
    try {
        const {
            discordId,
            gangA, slotA,
            gangB, slotB,
            betAmount, fightCount, location,
            dateStart, dateEnd, startTime,
            preEventActivity,
            outfitA, outfitB,
            bluffRules, notes,
            image,
            hasImage1, hasImage2
        } = req.body;

        // Validation
        if (!discordId) {
            return res.status(400).json({ success: false, error: 'กรุณาเชื่อมต่อ Discord ก่อนส่งข้อมูล' });
        }
        if (!gangA || !gangB) {
            return res.status(400).json({ success: false, error: 'กรุณากรอกชื่อทั้งสองฝั่ง' });
        }
        if (slotA === undefined || slotA === null || slotA === '' ||
            slotB === undefined || slotB === null || slotB === '') {
            return res.status(400).json({ success: false, error: 'กรุณากรอกจำนวน SLOT ทั้งสองฝั่ง' });
        }
        if (!betAmount && betAmount !== 0) {
            return res.status(400).json({ success: false, error: 'กรุณากรอกมูลค่าสินเดิมพันรวม' });
        }
        if (!fightCount) {
            return res.status(400).json({ success: false, error: 'กรุณากรอกจำนวนไฟต์' });
        }
        if (!location) {
            return res.status(400).json({ success: false, error: 'กรุณากรอกสถานที่' });
        }
        if (!dateStart || !dateEnd) {
            return res.status(400).json({ success: false, error: 'กรุณาเลือกวันที่' });
        }
        if (!startTime) {
            return res.status(400).json({ success: false, error: 'กรุณากรอกเวลาเริ่มไฟต์แรก' });
        }

        // ส่งข้อมูลโดยใช้ Discord Webhook Service
        await sendCouncil({
            discordId,
            discordName: req.body.discordName || '',
            gangA, slotA,
            gangB, slotB,
            betAmount, fightCount, location,
            dateStart, dateEnd, startTime,
            preEventActivity: preEventActivity || 'ไม่อนุญาต',
            outfitA, outfitB,
            bluffRules, notes,
            image
        });

        logger.info(`Council record submitted: ${gangA} vs ${gangB}`);
        res.json({ success: true, message: 'บันทึกสำเร็จ' });

    } catch (err) {
        logger.error(`Council submit error: ${err.message}`);
        res.status(500).json({ success: false, error: err.message || 'ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง' });
    }
}

module.exports = {
    submitCouncil
};
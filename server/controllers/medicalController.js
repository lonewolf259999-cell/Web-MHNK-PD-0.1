/* ========================================
   Controller - Medical Registration endpoints
   - POST /api/medical    → สมัครใหม่
   - PATCH /api/medical/edit → แก้ไขข้อมูลที่ส่งไปแล้ว
   ======================================== */

const { sendMedical, editMedicalMessage, fetchMedicalMessage } = require('../services/discordWebhook');
const { createLogger } = require('../utils/logger');

const logger = createLogger('MedicalController');

/**
 * Validate medical registration data
 */
function validateMedicalRegistration(data) {
    const errors = [];
    
    if (!data.icName || data.icName.trim().length === 0) {
        errors.push('กรุณากรอกชื่อ - นามสกุล (IC/ตามบัตร)');
    }
    if (!data.ocAge || isNaN(data.ocAge) || data.ocAge < 1 || data.ocAge > 120) {
        errors.push('กรุณากรอกอายุ (OC) ที่ถูกต้อง (1-120)');
    }
    if (!data.timeStart || data.timeStart.trim().length === 0) {
        errors.push('กรุณาระบุเวลาเริ่มปฏิบัติหน้าที่');
    }
    if (!data.timeEnd || data.timeEnd.trim().length === 0) {
        errors.push('กรุณาระบุเวลาสิ้นสุดปฏิบัติหน้าที่');
    }
    if (!data.medicalExperience || data.medicalExperience.trim().length === 0) {
        errors.push('กรุณาระบุประสบการณ์ด้านสายแพทย์');
    }
    if (!data.joinReason || data.joinReason.trim().length === 0) {
        errors.push('กรุณาระบุเหตุผลที่ต้องการเข้าร่วมหน่วยแพทย์');
    }
    if (!data.discordId || data.discordId.trim().length === 0) {
        errors.push('กรุณากรอก Discord ID');
    }
    
    return errors;
}

/**
 * POST /api/medical
 * Handle medical registration request
 */
async function registerMedical(req, res) {
    try {
        const { icName, ocAge, timeStart, timeEnd, medicalExperience, joinReason, discordId, discordUserId } = req.body;

        // Validate input
        const errors = validateMedicalRegistration({ icName, ocAge, timeStart, timeEnd, medicalExperience, joinReason, discordId });
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'ข้อมูลไม่ถูกต้อง',
                errors
            });
        }

        // Send to Discord Webhook (returns messageId)
        const result = await sendMedical({
            icName: icName.trim(),
            ocAge: parseInt(ocAge),
            timeStart: timeStart.trim(),
            timeEnd: timeEnd.trim(),
            medicalExperience: medicalExperience.trim(),
            joinReason: joinReason.trim(),
            discordId: discordId.trim(),
            discordUserId: discordUserId || null
        });

        logger.info(`New medical registration: ${icName} (${discordId}) msgId=${result.messageId}`);

        res.json({
            success: true,
            message: 'สมัครสำเร็จ! ข้อมูลถูกส่งไปยังทีมงานแล้ว',
            messageId: result.messageId
        });

    } catch (err) {
        logger.error(`Medical registration error: ${err.message}`);
        res.status(500).json({
            success: false,
            message: err.message || 'เกิดข้อผิดพลาดในการสมัคร กรุณาลองใหม่อีกครั้ง'
        });
    }
}

/**
 * PATCH /api/medical/edit
 * แก้ไขข้อมูลที่ส่งไปแล้ว (ใช้ messageId ที่ผู้ใช้คัดลอกจาก Discord)
 */
async function editMedical(req, res) {
    try {
        const { messageId, discordId, discordUserId, icName, ocAge, timeStart, timeEnd, medicalExperience, joinReason, editCount } = req.body;

        // Validate required fields
        if (!messageId) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ Message ID',
                errors: ['เปิด Discord → คลิกขวาที่ embed → Copy Message ID แล้วนำมาวาง']
            });
        }

        if (!discordId) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาเชื่อมต่อ Discord ก่อนแก้ไขข้อมูล'
            });
        }

        // Validate form data
        const errors = validateMedicalRegistration({ icName, ocAge, timeStart, timeEnd, medicalExperience, joinReason, plan, discordId });
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'ข้อมูลไม่ถูกต้อง',
                errors
            });
        }

        // Edit the Discord message (with ownership verification)
        const result = await editMedicalMessage({
            messageId,
            data: {
                icName: icName.trim(),
                ocAge: parseInt(ocAge),
                timeStart: timeStart.trim(),
                timeEnd: timeEnd.trim(),
                medicalExperience: medicalExperience.trim(),
                joinReason: joinReason.trim(),
                plan: plan.trim(),
                discordId: discordId.trim()
            },
            editCount: (parseInt(editCount) || 0) + 1,
            verifiedDiscordUserId: discordUserId || null
        });

        logger.info(`Medical registration edited: ${icName} (${discordId}) msgId=${messageId}`);

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลสำเร็จ! Embed ใน Discord อัปเดตแล้ว',
            editCount: (parseInt(editCount) || 0) + 1
        });

    } catch (err) {
        logger.error(`Edit medical registration error: ${err.message}`);

        // 404 error (message not found) — แจ้งผู้ใช้ชัดเจน
        if (err.message.includes('404') || err.message.includes('ไม่พบข้อความ')) {
            return res.status(404).json({
                success: false,
                message: 'ไม่พบข้อความใน Discord — Message ID ไม่ถูกต้อง หรือข้อความถูกลบไปแล้ว',
                hint: 'กรุณา copy Message ID ใหม่จาก Discord'
            });
        }

        res.status(500).json({
            success: false,
            message: err.message || 'เกิดข้อผิดพลาดในการแก้ไข กรุณาลองใหม่อีกครั้ง'
        });
    }
}

/**
 * GET /api/medical/fetch/:messageId
 * ดึงข้อมูลจาก Discord embed ผ่าน messageId
 */
async function fetchMedical(req, res) {
    try {
        const { messageId } = req.params;
        const discordUserId = req.query.discordUserId || null;

        if (!messageId) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ Message ID'
            });
        }

        const result = await fetchMedicalMessage(messageId, discordUserId);
        logger.info(`Medical registration fetched: msgId=${messageId}`);

        res.json({
            success: true,
            data: result.data,
            editCount: result.editCount,
            messageId: result.messageId
        });

    } catch (err) {
        logger.error(`Fetch medical registration error: ${err.message}`);

        if (err.message.includes('404') || err.message.includes('ไม่พบ')) {
            return res.status(404).json({
                success: false,
                message: err.message
            });
        }

        res.status(500).json({
            success: false,
            message: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล'
        });
    }
}

module.exports = { registerMedical, editMedical, fetchMedical };

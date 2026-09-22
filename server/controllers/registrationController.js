/* ========================================
   Controller - Registration endpoints (unified)
   - POST /api/register      → สมัครใหม่ (Police)
   - PATCH /api/register/edit → แก้ไข (Police)
   - POST /api/medical       → สมัครใหม่ (Medical)
   - PATCH /api/medical/edit  → แก้ไข (Medical)
   - GET  /api/register/fetch/:messageId → ดึงข้อมูล (Police)
   - GET  /api/medical/fetch/:messageId  → ดึงข้อมูล (Medical)
   ======================================== */

const { sendRegistration, editRegistrationMessage, fetchRegistrationMessage,
        sendMedical, editMedicalMessage, fetchMedicalMessage } = require('../services/discordWebhook');
const { addPendingRegistration, updatePendingRegistration } = require('../services/sheetsWriteService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('RegistrationController');

// ==================== Validation ====================

/**
 * Validate police registration data
 */
function validatePoliceRegistration(data) {
    const errors = [];
    
    if (!data.ocName || data.ocName.trim().length === 0) {
        errors.push('กรุณากรอกชื่อ OC');
    }
    if (!data.icName || data.icName.trim().length === 0) {
        errors.push('กรุณากรอกชื่อ IC');
    }
    if (!data.ocAge || isNaN(data.ocAge) || data.ocAge < 1 || data.ocAge > 120) {
        errors.push('กรุณากรอกอายุ OC ที่ถูกต้อง (1-120)');
    }
    if (!data.icPhone || data.icPhone.trim().length === 0) {
        errors.push('กรุณากรอกเบอร์ IC');
    }
    if (!data.discordId || data.discordId.trim().length === 0) {
        errors.push('กรุณากรอก Discord ID');
    }
    if (!data.steamUrl || data.steamUrl.trim().length === 0) {
        errors.push('กรุณากรอกลิงก์ Steam');
    } else if (!isValidUrl(data.steamUrl)) {
        errors.push('กรุณากรอกลิงก์ Steam ที่ถูกต้อง');
    }
    
    return errors;
}

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
 * Check if string is valid URL
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch {
        return false;
    }
}

// ==================== Police Registration ====================

/**
 * POST /api/register
 */
async function register(req, res) {
    try {
        const { ocName, icName, ocAge, icPhone, discordId, discordUserId, steamUrl, discordDisplayName } = req.body;

        const errors = validatePoliceRegistration({ ocName, icName, ocAge, icPhone, discordId, steamUrl });
        if (errors.length > 0) {
            return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', errors });
        }

        const result = await sendRegistration({
            ocName: ocName.trim(),
            icName: icName.trim(),
            ocAge: parseInt(ocAge),
            icPhone: icPhone.trim(),
            discordId: discordId.trim(),
            discordUserId: discordUserId || null,
            steamUrl: steamUrl.trim()
        });

        logger.info(`New registration: ${ocName} (${discordId}) msgId=${result.messageId}`);

        try {
            await addPendingRegistration({
                discordId: discordId.trim(),
                discordName: discordDisplayName || ocName.trim(),
                icName: icName.trim(),
                icPhone: icPhone.trim(),
                ocAge: parseInt(ocAge),
                steamUrl: steamUrl.trim(),
            });
        } catch (sheetErr) {
            logger.error(`Pending sheet write failed (non-critical): ${sheetErr.message}`);
        }

        res.json({
            success: true,
            message: 'สมัครสำเร็จ! ข้อมูลถูกส่งไปยังทีมงานแล้ว',
            messageId: result.messageId
        });

    } catch (err) {
        logger.error(`Registration error: ${err.message}`);
        res.status(500).json({
            success: false,
            message: err.message || 'เกิดข้อผิดพลาดในการสมัคร กรุณาลองใหม่อีกครั้ง'
        });
    }
}

/**
 * PATCH /api/register/edit
 */
async function editRegistration(req, res) {
    try {
        const { messageId, discordId, discordUserId, ocName, icName, ocAge, icPhone, steamUrl, editCount } = req.body;

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

        const errors = validatePoliceRegistration({ ocName, icName, ocAge, icPhone, discordId, steamUrl });
        if (errors.length > 0) {
            return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', errors });
        }

        const result = await editRegistrationMessage({
            messageId,
            data: {
                ocName: ocName.trim(),
                icName: icName.trim(),
                ocAge: parseInt(ocAge),
                icPhone: icPhone.trim(),
                discordId: discordId.trim(),
                steamUrl: steamUrl.trim()
            },
            editCount: (parseInt(editCount) || 0) + 1,
            verifiedDiscordUserId: discordUserId || null
        });

        logger.info(`Registration edited: ${ocName} (${discordId}) msgId=${messageId}`);

        try {
            await updatePendingRegistration(discordId.trim(), {
                icName: icName.trim(),
                icPhone: icPhone.trim(),
                ocAge: parseInt(ocAge),
                steamUrl: steamUrl.trim(),
            });
        } catch (sheetErr) {
            logger.error(`Pending sheet update failed (non-critical): ${sheetErr.message}`);
        }

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลสำเร็จ! Embed ใน Discord อัปเดตแล้ว',
            editCount: (parseInt(editCount) || 0) + 1
        });

    } catch (err) {
        logger.error(`Edit registration error: ${err.message}`);

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
 * GET /api/register/fetch/:messageId
 */
async function fetchRegistration(req, res) {
    try {
        const { messageId } = req.params;
        const discordUserId = req.query.discordUserId || null;

        if (!messageId) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุ Message ID' });
        }

        const result = await fetchRegistrationMessage(messageId, discordUserId);
        logger.info(`Registration fetched: msgId=${messageId}`);

        res.json({ success: true, data: result.data, editCount: result.editCount, messageId: result.messageId });

    } catch (err) {
        logger.error(`Fetch registration error: ${err.message}`);

        if (err.message.includes('404') || err.message.includes('ไม่พบ')) {
            return res.status(404).json({ success: false, message: err.message });
        }

        res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
}

// ==================== Medical Registration ====================

/**
 * POST /api/medical
 */
async function registerMedical(req, res) {
    try {
        const { icName, ocAge, timeStart, timeEnd, medicalExperience, joinReason, discordId, discordUserId } = req.body;

        const errors = validateMedicalRegistration({ icName, ocAge, timeStart, timeEnd, medicalExperience, joinReason, discordId });
        if (errors.length > 0) {
            return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', errors });
        }

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
 */
async function editMedical(req, res) {
    try {
        const { messageId, discordId, discordUserId, icName, ocAge, timeStart, timeEnd, medicalExperience, joinReason, editCount } = req.body;

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

        const errors = validateMedicalRegistration({ icName, ocAge, timeStart, timeEnd, medicalExperience, joinReason, discordId });
        if (errors.length > 0) {
            return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', errors });
        }

        const result = await editMedicalMessage({
            messageId,
            data: {
                icName: icName.trim(),
                ocAge: parseInt(ocAge),
                timeStart: timeStart.trim(),
                timeEnd: timeEnd.trim(),
                medicalExperience: medicalExperience.trim(),
                joinReason: joinReason.trim(),
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
 */
async function fetchMedical(req, res) {
    try {
        const { messageId } = req.params;
        const discordUserId = req.query.discordUserId || null;

        if (!messageId) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุ Message ID' });
        }

        const result = await fetchMedicalMessage(messageId, discordUserId);
        logger.info(`Medical registration fetched: msgId=${messageId}`);

        res.json({ success: true, data: result.data, editCount: result.editCount, messageId: result.messageId });

    } catch (err) {
        logger.error(`Fetch medical registration error: ${err.message}`);

        if (err.message.includes('404') || err.message.includes('ไม่พบ')) {
            return res.status(404).json({ success: false, message: err.message });
        }

        res.status(500).json({ success: false, message: err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
    }
}

module.exports = { register, editRegistration, fetchRegistration, registerMedical, editMedical, fetchMedical };
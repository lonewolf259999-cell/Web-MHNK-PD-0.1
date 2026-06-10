/* ========================================
   Controller - Registration endpoints
   - POST /api/register    → สมัครใหม่
   - PATCH /api/register/edit → แก้ไขข้อมูลที่ส่งไปแล้ว
   ======================================== */

const { sendRegistration, editRegistrationMessage, fetchRegistrationMessage } = require('../services/discordWebhook');
const { createLogger } = require('../utils/logger');

const logger = createLogger('RegisterController');

/**
 * Validate registration data
 */
function validateRegistration(data) {
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

/**
 * POST /api/register
 * Handle registration request
 */
async function register(req, res) {
    try {
        const { ocName, icName, ocAge, icPhone, discordId, discordUserId, steamUrl } = req.body;

        // Validate input
        const errors = validateRegistration({ ocName, icName, ocAge, icPhone, discordId, steamUrl });
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'ข้อมูลไม่ถูกต้อง',
                errors
            });
        }

        // Send to Discord Webhook (returns messageId)
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

        res.json({
            success: true,
            message: 'สมัครสำเร็จ! ข้อมูลถูกส่งไปยังทีมงานแล้ว',
            messageId: result.messageId  // ส่ง messageId กลับไปให้ client เก็บ
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
 * แก้ไขข้อมูลที่ส่งไปแล้ว (ใช้ messageId ที่ผู้ใช้คัดลอกจาก Discord)
 */
async function editRegistration(req, res) {
    try {
        const { messageId, discordId, discordUserId, ocName, icName, ocAge, icPhone, steamUrl, editCount } = req.body;

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
        const errors = validateRegistration({ ocName, icName, ocAge, icPhone, discordId, steamUrl });
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'ข้อมูลไม่ถูกต้อง',
                errors
            });
        }

        // Edit the Discord message (with ownership verification)
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

        res.json({
            success: true,
            message: 'แก้ไขข้อมูลสำเร็จ! Embed ใน Discord อัปเดตแล้ว',
            editCount: (parseInt(editCount) || 0) + 1
        });

    } catch (err) {
        logger.error(`Edit registration error: ${err.message}`);

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
 * GET /api/register/fetch/:messageId
 * ดึงข้อมูลจาก Discord embed ผ่าน messageId
 */
async function fetchRegistration(req, res) {
    try {
        const { messageId } = req.params;
        const discordUserId = req.query.discordUserId || null;

        if (!messageId) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ Message ID'
            });
        }

        const result = await fetchRegistrationMessage(messageId, discordUserId);
        logger.info(`Registration fetched: msgId=${messageId}`);

        res.json({
            success: true,
            data: result.data,
            editCount: result.editCount,
            messageId: result.messageId
        });

    } catch (err) {
        logger.error(`Fetch registration error: ${err.message}`);

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

module.exports = { register, editRegistration, fetchRegistration };

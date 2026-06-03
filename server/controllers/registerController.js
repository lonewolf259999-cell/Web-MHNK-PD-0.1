/* ========================================
   Controller - Registration endpoints
   ======================================== */

const discordWebhook = require('../services/discordWebhook');

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

        // Send to Discord Webhook
        await discordWebhook.sendRegistration({
            ocName: ocName.trim(),
            icName: icName.trim(),
            ocAge: parseInt(ocAge),
            icPhone: icPhone.trim(),
            discordId: discordId.trim(),
            discordUserId: discordUserId || null,
            steamUrl: steamUrl.trim()
        });

        console.log(`[Register] New registration: ${ocName} (${discordId})`);

        res.json({
            success: true,
            message: 'สมัครสำเร็จ! ข้อมูลถูกส่งไปยังทีมงานแล้ว'
        });

    } catch (err) {
        console.error('[Register] Error:', err.message);
        res.status(500).json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการสมัคร กรุณาลองใหม่อีกครั้ง'
        });
    }
}

module.exports = { register };
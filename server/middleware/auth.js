/* ========================================
   Middleware - PIN Authentication
   ======================================== */

const config = require('../config');

/**
 * Verify admin PIN from request body
 * 
 * SECURITY: If ADMIN_PIN is not configured in environment,
 * all admin requests are rejected to prevent unauthorized access.
 */
function verifyPin(req, res, next) {
    const { pin } = req.body;

    // If no ADMIN_PIN is configured, reject all requests
    if (!config.ADMIN_PIN) {
        return res.status(500).json({ error: 'ระบบยังไม่ได้ตั้งค่ารหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ' });
    }

    if (pin !== config.ADMIN_PIN) {
        return res.status(401).json({ error: 'รหัส PIN ไม่ถูกต้อง' });
    }

    next();
}

module.exports = { verifyPin };

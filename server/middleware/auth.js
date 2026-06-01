/* ========================================
   Middleware - PIN Authentication
   ======================================== */

const config = require('../config');

/**
 * Verify admin PIN from request body
 */
function verifyPin(req, res, next) {
    const { pin } = req.body;

    if (pin !== config.ADMIN_PIN) {
        return res.status(401).json({ error: 'รหัส PIN ไม่ถูกต้อง' });
    }

    next();
}

module.exports = { verifyPin };
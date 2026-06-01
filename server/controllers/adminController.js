/* ========================================
   Controller - Admin endpoints
   ======================================== */

const sheetsService = require('../services/sheetsService');

async function markPaid(req, res) {
    const { weekName, officerName } = req.body;

    if (!weekName || !officerName) {
        throw new Error('Missing required fields: weekName, officerName');
    }

    const result = await sheetsService.markOfficerAsPaid(weekName, officerName);
    res.json({
        success: true,
        message: `อัปเดตแถวที่ ${result.rowIndex} สำเร็จ`
    });
}

module.exports = { markPaid };
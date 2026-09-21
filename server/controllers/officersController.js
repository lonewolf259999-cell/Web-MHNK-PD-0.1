/* ========================================
   Controller - Officers endpoints
   ======================================== */

const sheetsService = require('../services/sheetsService');

async function getOfficers(req, res) {
    const officers = await sheetsService.getOfficers();
    res.json(officers);
}

async function refreshData(req, res) {
    const freshOfficers = await sheetsService.refreshAll();
    res.json({
        success: true,
        message: `รีเฟรชสำเร็จ: ${freshOfficers.length} นาย`,
        count: freshOfficers.length
    });
}

module.exports = { getOfficers, refreshData };
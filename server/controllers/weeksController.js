/* ========================================
   Controller - Weeks endpoints
   ======================================== */

const sheetsService = require('../services/sheetsService');

async function getWeeks(req, res) {
    const weeks = await sheetsService.getWeekNames();
    res.json(weeks);
}

async function getWeekData(req, res) {
    const weekName = req.query.name;
    if (!weekName) {
        throw new Error('Missing week name');
    }
    const data = await sheetsService.getWeekData(weekName);
    res.json(data);
}

module.exports = { getWeeks, getWeekData };
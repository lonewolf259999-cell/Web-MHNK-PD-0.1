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

async function getWeekTop10(req, res) {
    const result = await sheetsService.getLatestWeekTop10();
    res.json(result);
}

module.exports = { getWeeks, getWeekData, getWeekTop10 };

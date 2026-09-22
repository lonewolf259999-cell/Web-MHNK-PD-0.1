/* ========================================
   Controller - Static JSON endpoints
   ======================================== */

const sheetsService = require('../services/sheetsService');

function getStaticData(req, res) {
    const data = sheetsService.getStaticJSON('schedule');
    
    if (data) {
        res.json(data);
    } else {
        throw new Error('Data not found');
    }
}

module.exports = { getStaticData };
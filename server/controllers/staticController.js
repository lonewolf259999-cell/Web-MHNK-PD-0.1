/* ========================================
   Controller - Static JSON endpoints
   ======================================== */

const sheetsService = require('../services/sheetsService');

function getStaticData(req, res) {
    const type = req.params.type === 'schedule-config' ? 'schedule' : req.params.type;
    const data = sheetsService.getStaticJSON(type);
    
    if (data) {
        res.json(data);
    } else {
        throw new Error('Data not found');
    }
}

module.exports = { getStaticData };
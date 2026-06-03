/* ========================================
    Controller - Rules/Conduct/Fines CRUD endpoints
    ======================================== */

const sheetsService = require('../services/sheetsService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('RulesController');

/**
 * Get rules/conduct/fines data
 */
async function getRulesData(req, res) {
    const type = req.params.type;
    if (!['conduct', 'rules', 'fines'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be: conduct, rules, or fines' });
    }

    try {
        let data;
        switch (type) {
            case 'conduct':
                data = await sheetsService.getConduct();
                break;
            case 'rules':
                data = await sheetsService.getRules();
                break;
            case 'fines':
                data = await sheetsService.getFines();
                break;
        }

        logger.debug(`GET ${type}: ${data.length} items`);
        res.json(data);
    } catch (err) {
        logger.error(`GET ${type} error: ${err.message}`);
        res.status(500).json({ error: `Failed to load ${type}: ${err.message}` });
    }
}

/**
 * Add new rule/conduct/fine
 */
async function addRule(req, res) {
    const type = req.params.type;
    const { id, title, category, text, amount, time } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'Missing required field: id' });
    }

    try {
        const data = { id, title, category, text, amount, time };
        const result = await sheetsService.addRule(type, data);

        logger.info(`POST ${type} success: id=${id}`);
        res.json({
            success: true,
            message: `เพิ่มข้อมูลสำเร็จ`,
            data: result
        });
    } catch (err) {
        logger.error(`POST ${type} error: ${err.message}`);
        res.status(500).json({ error: `Failed to add ${type}: ${err.message}` });
    }
}

/**
 * Update existing rule/conduct/fine
 */
async function updateRule(req, res) {
    const type = req.params.type;
    const id = req.params.id;
    const { title, category, text, amount, time } = req.body;

    try {
        const data = { id, title, category, text, amount, time };
        const result = await sheetsService.updateRule(type, id, data);

        logger.info(`PUT ${type} success: id=${id}`);
        res.json({
            success: true,
            message: `แก้ไขข้อมูลสำเร็จ`,
            data: result
        });
    } catch (err) {
        logger.error(`PUT ${type} error: ${err.message}`);
        res.status(500).json({ error: `Failed to update ${type}: ${err.message}` });
    }
}

/**
 * Delete rule/conduct/fine
 */
async function deleteRule(req, res) {
    const type = req.params.type;
    const id = req.params.id;

    try {
        const result = await sheetsService.deleteRule(type, id);

        logger.info(`DELETE ${type} success: id=${id}`);
        res.json({
            success: true,
            message: `ลบข้อมูลสำเร็จ`,
            data: result
        });
    } catch (err) {
        logger.error(`DELETE ${type} error: ${err.message}`);
        res.status(500).json({ error: `Failed to delete ${type}: ${err.message}` });
    }
}

module.exports = {
    getRulesData,
    addRule,
    updateRule,
    deleteRule
};
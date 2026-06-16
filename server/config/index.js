/* ========================================
   Configuration - All env vars & constants
   ======================================== */

const path = require('path');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Config');

require('dotenv').config();

// Validate required env vars
const requiredEnvs = ['SHEET_ID', 'CASES_SHEET_ID', 'RULES_SHEET_ID'];
requiredEnvs.forEach(env => {
    if (!process.env[env]) logger.warn(`${env} is not defined in .env file`);
});

const CREDENTIALS_PATH = path.join(__dirname, '..', '..', 'credentials.json');
if (!process.env.GOOGLE_JSON_KEY && !require('fs').existsSync(CREDENTIALS_PATH)) {
    logger.warn('Google credentials (GOOGLE_JSON_KEY or credentials.json file) not found');
}

module.exports = {
    PORT: process.env.PORT || 3001,
    SHEET_ID: process.env.SHEET_ID,
    CASES_SHEET_ID: process.env.CASES_SHEET_ID,
    RULES_SHEET_ID: process.env.RULES_SHEET_ID,
    SHEET_NAME: 'NamePD',
    CASES_SHEET_NAME: 'CaseAll',
    CONDUCT_SHEET_NAME: 'conduct',
    RULES_SHEET_NAME: 'rules',
    FINES_SHEET_NAME: 'fines',
    ADMIN_PIN: process.env.ADMIN_PIN,
    DISCORD_REGISTER_WEBHOOK_URL: process.env.DISCORD_REGISTER_WEBHOOK_URL || '',
    DISCORD_COUNCIL_WEBHOOK_URL: process.env.DISCORD_COUNCIL_WEBHOOK_URL || '',
    DISCORD_MEDICAL_WEBHOOK_URL: process.env.DISCORD_MEDICAL_WEBHOOK_URL || '',
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || '',
    APP_URL: process.env.APP_URL || `http://localhost:${process.env.PORT || 3001}`,
    PENDING_SPREADSHEET_ID: process.env.PENDING_SPREADSHEET_ID || process.env.SHEET_ID,
    PENDING_SHEET_NAME: process.env.PENDING_SHEET_NAME || 'Pending',
    CREDENTIALS_PATH,
    CACHE_TTL: 15000,          // 15 seconds memory cache
    FILE_CACHE_TTL: 600000,    // 10 minutes file cache
    CACHE_FILE: path.join(__dirname, '..', '..', 'data', '.officers-cache.json'),
    MAX_CACHE_KEYS: 100,       // prevent memory leak
    COMPRESSION_THRESHOLD: 512, // bytes
    COMPRESSION_LEVEL: 6,
    REQUEST_TIMEOUT: 10000,    // 10 seconds
};
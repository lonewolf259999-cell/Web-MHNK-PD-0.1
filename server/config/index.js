/* ========================================
   Configuration - All env vars & constants
   ======================================== */

const path = require('path');

require('dotenv').config();

// Validate required env vars
const requiredEnvs = ['SHEET_ID', 'CASES_SHEET_ID', 'RULES_SHEET_ID'];
requiredEnvs.forEach(env => {
    if (!process.env[env]) console.warn(`⚠️ Warning: ${env} is not defined in .env file`);
});

const CREDENTIALS_PATH = path.join(__dirname, '..', '..', 'credentials.json');
if (!process.env.GOOGLE_JSON_KEY && !require('fs').existsSync(CREDENTIALS_PATH)) {
    console.warn('⚠️ Warning: Google credentials (GOOGLE_JSON_KEY or credentials.json file) not found.');
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
    ADMIN_PIN: process.env.ADMIN_PIN || '1234',
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL || '',
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || '',
    CREDENTIALS_PATH,
    CACHE_TTL: 15000,          // 15 seconds memory cache
    FILE_CACHE_TTL: 600000,    // 10 minutes file cache
    CACHE_FILE: path.join(__dirname, '..', '..', 'data', '.officers-cache.json'),
    MAX_CACHE_KEYS: 100,       // prevent memory leak
    COMPRESSION_THRESHOLD: 512, // bytes
    COMPRESSION_LEVEL: 6,
    REQUEST_TIMEOUT: 10000,    // 10 seconds
};
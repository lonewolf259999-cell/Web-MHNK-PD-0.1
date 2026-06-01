/* ========================================
   Sheets Service - Business Logic Layer
   - Fetch data from Google Sheets
   - Parse & map data
   - Manage cache
   ======================================== */

const https = require('https');
const config = require('../config');
const cacheService = require('./cacheService');
const csvParser = require('./csvParser');
const { getSheets } = require('../config/googleAuth');

/**
 * Fetch CSV data from Google Sheets via GViz API
 */
function fetchGvizCSV(sheetId, sheetName) {
    return new Promise((resolve, reject) => {
        const encodedName = encodeURIComponent(sheetName);
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&tq&sheet=${encodedName}&_t=${Date.now()}`;

        const request = https.get(url, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);

        request.setTimeout(config.REQUEST_TIMEOUT, () => {
            request.destroy();
            reject(new Error('Request timeout fetching sheet data'));
        });
    });
}

/**
 * Get static JSON data from /data folder
 */
function getStaticJSON(name) {
    try {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '..', '..', 'data', name + '.json');
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

// ==================== Business Logic Functions ====================

async function getOfficers() {
    const cached = cacheService.get('officers');
    if (cached) return cached;

    const csvText = await fetchGvizCSV(config.SHEET_ID, config.SHEET_NAME);
    const rows = csvParser.parseCSV(csvText);
    const officers = csvParser.mapOfficers(rows);

    cacheService.set('officers', officers);
    cacheService.saveFileCache(officers);
    return officers;
}

async function getWeekNames() {
    const cached = cacheService.get('weekNames');
    if (cached) return cached;

    const csvText = await fetchGvizCSV(config.CASES_SHEET_ID, config.CASES_SHEET_NAME);
    const rows = csvParser.parseCSV(csvText);
    const weeks = csvParser.mapWeekNames(rows);

    cacheService.set('weekNames', weeks);
    return weeks;
}

async function getWeekData(weekName) {
    const cacheKey = 'week_' + weekName;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const csvText = await fetchGvizCSV(config.CASES_SHEET_ID, weekName);
    const rows = csvParser.parseCSV(csvText);
    const data = csvParser.mapWeekData(rows);

    cacheService.set(cacheKey, data);
    return data;
}

async function markOfficerAsPaid(weekName, officerName) {
    const sheets = getSheets();

    // Find the officer's row in the sheet
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.CASES_SHEET_ID,
        range: `${weekName}!A:A`,
    });

    const rows = response.data.values;
    if (!rows) throw new Error('ไม่พบข้อมูลในชีต');

    let rowIndex = -1;
    const searchName = officerName.toLowerCase();

    for (let i = 3; i < rows.length; i++) {
        const cellValue = String(rows[i][0] || '').trim().toLowerCase();
        if (!cellValue) continue;

        if (cellValue.includes(searchName) || searchName.includes(cellValue)) {
            rowIndex = i + 1; // Google Sheets 1-based index
            break;
        }
    }

    if (rowIndex === -1) {
        throw new Error('ไม่พบชื่อเจ้าหน้าที่ในชีตสัปดาห์นี้');
    }

    // Update checkbox in column X
    await sheets.spreadsheets.values.update({
        spreadsheetId: config.CASES_SHEET_ID,
        range: `'${weekName}'!X${rowIndex}:X${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[true]] },
    });

    // Invalidate cache for this week
    cacheService.invalidate('week_' + weekName);

    return { rowIndex };
}

async function refreshAll() {
    // Clear all memory cache
    cacheService.clearAll();

    // Fetch fresh officers data
    const csvText = await fetchGvizCSV(config.SHEET_ID, config.SHEET_NAME);
    const rows = csvParser.parseCSV(csvText);
    const freshOfficers = csvParser.mapOfficers(rows);

    if (freshOfficers.length > 0) {
        cacheService.set('officers', freshOfficers);
        cacheService.saveFileCache(freshOfficers);
    }

    return freshOfficers;
}

async function preWarmCache() {
    console.log('🔥 Pre-warming cache...');

    // Try loading from file cache first
    const hasFileCache = cacheService.loadFileCache();

    // Still fetch from Google Sheets in background (silent update)
    try {
        const csvText = await fetchGvizCSV(config.SHEET_ID, config.SHEET_NAME);
        const rows = csvParser.parseCSV(csvText);
        const freshOfficers = csvParser.mapOfficers(rows);

        if (freshOfficers.length > 0) {
            cacheService.set('officers', freshOfficers);
            cacheService.saveFileCache(freshOfficers);
            console.log(`🔥 Pre-warm complete: ${freshOfficers.length} officers loaded from Google Sheets`);
        }
    } catch (err) {
        if (hasFileCache) {
            console.log('🔥 Google Sheets fetch failed, using file cache (serving stale data temporarily)');
        } else {
            console.warn('🔥 Pre-warm failed (no cache available):', err.message);
        }
    }
}

module.exports = {
    getOfficers,
    getWeekNames,
    getWeekData,
    markOfficerAsPaid,
    refreshAll,
    preWarmCache,
    getStaticJSON,
    fetchGvizCSV // exposed for testing
};
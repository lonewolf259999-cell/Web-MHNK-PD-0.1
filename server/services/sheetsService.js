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
const { createLogger } = require('../utils/logger');

const logger = createLogger('Sheets');

/**
 * Normalize an officer name for reliable comparison
 * (trim, collapse multiple spaces, lowercase)
 */
function normalizeOfficerName(name) {
    return String(name || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

/**
 * Fetch CSV data from Google Sheets via GViz API
 */
function fetchGvizCSV(sheetId, sheetName) {
    return new Promise((resolve, reject) => {
        const encodedName = encodeURIComponent(sheetName);
        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&tq&sheet=${encodedName}&_t=${Date.now()}`;

        logger.debug(`Fetching: ${sheetName}`);

        const request = https.get(url, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode} for sheet ${sheetName}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                logger.debug(`Received ${data.length} bytes for ${sheetName}`);
                resolve(data);
            });
        }).on('error', (err) => {
            logger.error(`Error fetching ${sheetName}: ${err.message}`);
            reject(err);
        });

        request.setTimeout(config.REQUEST_TIMEOUT, () => {
            request.destroy();
            reject(new Error(`Request timeout fetching sheet ${sheetName}`));
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

/**
 * Get TOP 10 from the latest week (excluding "test" weeks)
 * Uses CASES_SHEET_ID (1vHEsytsmytswkh9YWdcCyYMtfRcQNoSTFH2v7G19gTg)
 * Reads week names from CaseAll (col H), then loads latest week data
 */
async function getLatestWeekTop10() {
    const cacheKey = 'week_top10';
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    // 1. Get all week names
    const csvText = await fetchGvizCSV(config.CASES_SHEET_ID, config.CASES_SHEET_NAME);
    const rows = csvParser.parseCSV(csvText);
    const weeks = csvParser.mapWeekNames(rows);

    // 2. Filter out "test" and find the latest (last in list)
    const realWeeks = weeks.filter(w => w.toLowerCase() !== 'test');
    if (realWeeks.length === 0) {
        return { weekName: '', top10: [] };
    }
    const latestWeek = realWeeks[realWeeks.length - 1];

    // 3. Load that week's data
    const weekCsv = await fetchGvizCSV(config.CASES_SHEET_ID, latestWeek);
    const weekRows = csvParser.parseCSV(weekCsv);
    const weekData = csvParser.mapWeekData(weekRows);

    // 4. Convert to array, sort by totalCases desc, take top 10
    const officers = Object.values(weekData);
    officers.sort((a, b) => {
        const casesA = parseFloat(a.totalCases) || 0;
        const casesB = parseFloat(b.totalCases) || 0;
        return casesB - casesA;
    });
    const top10 = officers.slice(0, 10).map(o => ({
        name: o.name,
        rank: o.rank,
        totalCases: parseFloat(o.totalCases) || 0
    }));

    const result = { weekName: latestWeek, top10 };
    cacheService.set(cacheKey, result);
    return result;
}

// ==================== Rules/Conduct/Fines (Google Sheets) ====================

/**
 * Fetch rules/conduct/fines from Google Sheets using Sheets API
 * Data starts at row 3, columns C, D, E, F, G
 * conduct: C=id, D=title, E=text
 * rules: C=id, D=category, E=text
 * fines: C=id, D=category, E=text, F=amount, G=time
 */
async function fetchRulesData(type) {
    const cacheKey = 'rules_' + type;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const sheetName = type === 'conduct' ? config.CONDUCT_SHEET_NAME :
                      type === 'rules' ? config.RULES_SHEET_NAME :
                      config.FINES_SHEET_NAME;

    logger.debug(`Fetching ${type} from sheet: ${sheetName}`);

    try {
        // Use Google Sheets API directly (more reliable than GViz)
        const sheets = getSheets();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.RULES_SHEET_ID,
            range: `${sheetName}!C:G`,
        });

        const rows = response.data.values || [];

        // Skip first 2 rows (row 1-2 are empty), data starts at row 3 (index 2)
        const dataRows = rows.slice(2);

        const items = [];
        for (const row of dataRows) {
            // Column C = index 0, D = index 1, E = index 2, F = index 3, G = index 4
            const id = row[0] ? String(row[0]).trim() : '';
            if (!id) continue;

            const item = { id };

            if (type === 'conduct') {
                item.title = row[1] ? String(row[1]).trim() : '';
                item.text = row[2] ? String(row[2]).trim() : '';
            } else if (type === 'rules') {
                item.category = row[1] ? String(row[1]).trim() : '';
                item.text = row[2] ? String(row[2]).trim() : '';
            } else if (type === 'fines') {
                item.category = row[1] ? String(row[1]).trim() : '';
                item.text = row[2] ? String(row[2]).trim() : '';
                item.amount = row[3] ? String(row[3]).trim() : '';
                item.time = row[4] ? String(row[4]).trim() : '';
            }

            items.push(item);
        }

        logger.info(`Loaded ${items.length} ${type} items`);

        cacheService.set(cacheKey, items);
        return items;
    } catch (err) {
        logger.error(`Error fetching ${type}: ${err.message}`);
        throw err;
    }
}

async function getConduct() {
    return fetchRulesData('conduct');
}

async function getRules() {
    return fetchRulesData('rules');
}

async function getFines() {
    return fetchRulesData('fines');
}

/**
 * Fetch cases data from the Cases Google Sheet
 * Uses CASES_DATA_SHEET_ID, sheet name 'Cases'
 * NOTE: This is DIFFERENT from CASES_SHEET_NAME ('CaseAll') which stores weekly data.
 * Columns: A=id, B=title, C=description (HTML supported), D=video_url (Google Drive link)
 * Data starts at row 2 (skip header row 1)
 */
async function getCases() {
    const cacheKey = 'cases_data';
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;

    const sheetName = 'Cases';

    logger.debug(`Fetching cases from sheet: ${sheetName}`);

    try {
        const sheets = getSheets();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: config.CASES_DATA_SHEET_ID,
            range: `${sheetName}!A:D`,
        });

        const rows = response.data.values || [];

        // Skip header row (row 1 = index 0)
        const dataRows = rows.slice(1);

        const items = [];
        for (const row of dataRows) {
            const id = row[0] ? String(row[0]).trim() : '';
            if (!id) continue;

            const item = {
                id,
                title: row[1] ? String(row[1]).trim() : '',
                description: row[2] ? String(row[2]).trim() : '',
                video_url: row[3] ? String(row[3]).trim() : '',
            };

            items.push(item);
        }

        logger.info(`Loaded ${items.length} cases`);
        cacheService.set(cacheKey, items);
        return items;
    } catch (err) {
        logger.error(`Error fetching cases: ${err.message}`);
        throw err;
    }
}

/**
 * Add a new rule/conduct/fine to Google Sheets
 */
async function addRule(type, data) {
    const sheets = getSheets();
    const sheetName = type === 'conduct' ? config.CONDUCT_SHEET_NAME :
                      type === 'rules' ? config.RULES_SHEET_NAME :
                      config.FINES_SHEET_NAME;

    logger.info(`Adding ${type} to sheet: ${sheetName}`);

    // Get all data to find the next empty row
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.RULES_SHEET_ID,
        range: `${sheetName}!C:G`,
    });

    const rows = response.data.values || [];
    // Data starts at row 3 (index 2), find next empty row
    let nextRow = 3; // Default to row 3
    for (let i = 2; i < rows.length; i++) {
        if (!rows[i] || !rows[i][0] || String(rows[i][0]).trim() === '') {
            nextRow = i + 1; // Convert to 1-based
            break;
        }
        nextRow = i + 2; // Next row after last data row
    }

    const rowData = buildRowData(type, data);
    logger.debug(`Writing to row ${nextRow}`);

    await sheets.spreadsheets.values.update({
        spreadsheetId: config.RULES_SHEET_ID,
        range: `${sheetName}!C${nextRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [rowData] },
    });

    cacheService.invalidate('rules_' + type);
    return { id: data.id, row: nextRow };
}

/**
 * Update an existing rule/conduct/fine in Google Sheets
 */
async function updateRule(type, id, data) {
    const sheets = getSheets();
    const sheetName = type === 'conduct' ? config.CONDUCT_SHEET_NAME :
                      type === 'rules' ? config.RULES_SHEET_NAME :
                      config.FINES_SHEET_NAME;

    logger.info(`Updating ${type} id=${id}`);

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.RULES_SHEET_ID,
        range: `${sheetName}!C:G`,
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    // Data starts at row 3 (index 2)
    for (let i = 2; i < rows.length; i++) {
        const cellValue = rows[i] && rows[i][0] ? String(rows[i][0]).trim() : '';
        if (cellValue === id) {
            rowIndex = i + 1; // Convert to 1-based
            break;
        }
    }

    if (rowIndex === -1) {
        throw new Error('ไม่พบข้อมูลที่ต้องการแก้ไข');
    }

    const rowData = buildRowData(type, data);

    await sheets.spreadsheets.values.update({
        spreadsheetId: config.RULES_SHEET_ID,
        range: `${sheetName}!C${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [rowData] },
    });

    cacheService.invalidate('rules_' + type);
    return { id, row: rowIndex };
}

/**
 * Delete a rule/conduct/fine from Google Sheets
 */
async function deleteRule(type, id) {
    const sheets = getSheets();
    const sheetName = type === 'conduct' ? config.CONDUCT_SHEET_NAME :
                      type === 'rules' ? config.RULES_SHEET_NAME :
                      config.FINES_SHEET_NAME;

    logger.info(`Deleting ${type} id=${id}`);

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.RULES_SHEET_ID,
        range: `${sheetName}!C:G`,
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    for (let i = 2; i < rows.length; i++) {
        const cellValue = rows[i] && rows[i][0] ? String(rows[i][0]).trim() : '';
        if (cellValue === id) {
            rowIndex = i + 1;
            break;
        }
    }

    if (rowIndex === -1) {
        throw new Error('ไม่พบข้อมูลที่ต้องการลบ');
    }

    // Clear the row
    const emptyRow = ['', '', '', '', ''];
    await sheets.spreadsheets.values.update({
        spreadsheetId: config.RULES_SHEET_ID,
        range: `${sheetName}!C${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [emptyRow] },
    });

    cacheService.invalidate('rules_' + type);
    return { id, row: rowIndex };
}

/**
 * Build row data array based on type
 */
function buildRowData(type, data) {
    if (type === 'conduct') {
        return [data.id, data.title || '', data.text || ''];
    } else if (type === 'rules') {
        return [data.id, data.category || '', data.text || ''];
    } else if (type === 'fines') {
        return [data.id, data.category || '', data.text || '', data.amount || '', data.time || ''];
    }
    return [];
}

async function markOfficerAsPaid(weekName, officerName) {
    const sheets = getSheets();

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.CASES_SHEET_ID,
        range: `${weekName}!A:A`,
    });

    const rows = response.data.values;
    if (!rows) throw new Error('ไม่พบข้อมูลในชีต');

    const searchName = normalizeOfficerName(officerName);
    if (!searchName) throw new Error('ไม่พบชื่อเจ้าหน้าที่ในชีตสัปดาห์นี้');

    // จำนวนแถวแรกที่เป็นหัวตาราง/ชื่อคอลัมน์ (ปรับได้ที่จุดเดียวถ้ารูปแบบชีตเปลี่ยน)
    const DATA_START_ROW_INDEX = 3;

    const exactMatches = [];
    const fuzzyMatches = [];

    for (let i = DATA_START_ROW_INDEX; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue; // กัน row ว่าง (เดิมอาจ throw TypeError)
        const cellValue = normalizeOfficerName(row[0]);
        if (!cellValue) continue;

        if (cellValue === searchName) {
            exactMatches.push(i + 1);
        } else if (cellValue.includes(searchName) || searchName.includes(cellValue)) {
            fuzzyMatches.push(i + 1);
        }
    }

    let rowIndex = -1;

    // ลำดับ優先: match แบบตรงเป๊ะก่อน ให้ความปลอดภัยสูงสุด
    if (exactMatches.length === 1) {
        rowIndex = exactMatches[0];
    } else if (exactMatches.length > 1) {
        // เจอชื่อซ้ำหลายแถวทั้งที่ match แบบตรง -> ปฏิเสธเพื่อไม่ให้เขียนผิดคน
        throw new Error(`พบชื่อเจ้าหน้าที่ซ้ำกัน ${exactMatches.length} แถว กรุณาตรวจสอบข้อมูล`);
    } else if (fuzzyMatches.length === 1) {
        // ไม่มีแบบตรงเป๊ะ -> ใช้แบบหลวมได้เฉพาะเมื่อไม่กำกวม (1 แถวเท่านั้น)
        rowIndex = fuzzyMatches[0];
    } else if (fuzzyMatches.length > 1) {
        throw new Error(`พบชื่อเจ้าหน้าที่ซ้ำกัน ${fuzzyMatches.length} แถว กรุณาตรวจสอบข้อมูล`);
    }

    if (rowIndex === -1) {
        throw new Error('ไม่พบชื่อเจ้าหน้าที่ในชีตสัปดาห์นี้');
    }

    await sheets.spreadsheets.values.update({
        spreadsheetId: config.CASES_SHEET_ID,
        range: `'${weekName}'!X${rowIndex}:X${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[true]] },
    });

    cacheService.invalidate('week_' + weekName);
    return { rowIndex };
}

async function refreshAll() {
    cacheService.clearAll();

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
    logger.info('Pre-warming cache...');

    const hasFileCache = cacheService.loadFileCache();

    try {
        const csvText = await fetchGvizCSV(config.SHEET_ID, config.SHEET_NAME);
        const rows = csvParser.parseCSV(csvText);
        const freshOfficers = csvParser.mapOfficers(rows);

        if (freshOfficers.length > 0) {
            cacheService.set('officers', freshOfficers);
            cacheService.saveFileCache(freshOfficers);
            logger.info(`Pre-warm complete: ${freshOfficers.length} officers loaded`);
        }
    } catch (err) {
        if (hasFileCache) {
            logger.info('Google Sheets fetch failed, using file cache');
        } else {
            logger.warn(`Pre-warm failed: ${err.message}`);
        }
    }
}

module.exports = {
    getOfficers,
    getWeekNames,
    getWeekData,
    getLatestWeekTop10,
    markOfficerAsPaid,
    refreshAll,
    preWarmCache,
    getStaticJSON,
    fetchGvizCSV,
    getConduct,
    getRules,
    getFines,
    getCases,
    addRule,
    updateRule,
    deleteRule
};

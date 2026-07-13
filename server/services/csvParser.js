/* ========================================
   CSV Parser + Data Mappers
   ======================================== */

/**
 * Parse CSV text into array of row arrays
 */
function parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    const rows = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        rows.push(parseCSVLine(line));
    }
    return rows;
}

/**
 * Parse a single CSV line (handles quoted fields)
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                result.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
    }
    result.push(current);
    return result;
}

/**
 * Get cell value safely with cleanup
 */
function getCell(row, index) {
    if (!row || index >= row.length) return '';
    const val = (row[index] || '').replace(/^"|"$/g, '').trim();
    return val;
}

/**
 * Map officers from CSV rows
 * Columns (0-indexed):
 *   A(0), B(1), C(2)=code, D(3)=name, E(4), F(5)=rank, G(6)=cases
 *   O(14) to U(20) = schedule Mon-Sun
 *   M(12) = steamId
 */
function mapOfficers(rows) {
    const officers = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const code = getCell(row, 2);
        // Valid code: 1-3 digit number only
        if (!code || code.length > 3 || !/^[0-9]+$/.test(code)) continue;

        const name = getCell(row, 3);
        if (!name) continue;

        // Schedule columns O(14) to U(20)
        const schedule = [];
        for (let d = 0; d < 7; d++) {
            schedule.push(getCell(row, 14 + d));
        }

        officers.push({
            code,
            name,
            phone: getCell(row, 1),
            rank: getCell(row, 5),
            cases: getCell(row, 6),
            steamId: getCell(row, 12),
            fullName: code + ' ' + name,
            schedule
        });
    }
    return officers;
}

/**
 * Map week data from CSV rows
 * Columns: A(0)=name, H(7)=rank, J(9)=cases, K(10)=interrogations, U(20)=salary, X(23)=paid
 */
function mapWeekData(rows) {
    const data = {};
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const name = getCell(row, 0);
        if (!name || name === 'ชื่อ-นามสกุล') continue; // Skip header

        const salaryRaw = getCell(row, 20).replace(/[^0-9.]/g, ''); // Remove ฿ and ,

        data[name] = {
            name,
            rank: getCell(row, 7),
            take2: getCell(row, 2),          // Column C
            weeklyCases: getCell(row, 3),    // Column D
            interrogations: getCell(row, 5), // Column F (raw, not divided)
            totalCases: getCell(row, 9),     // Column J
            totalAmount: parseFloat(salaryRaw) || 0, // Column U
            paid: getCell(row, 23)
        };
    }
    return data;
}

/**
 * Get week names from cases sheet (column H, row 4+)
 */
function mapWeekNames(rows) {
    const weeks = [];
    rows.forEach((row) => {
        const weekName = getCell(row, 7); // Column H
        if (weekName &&
            weekName !== '' &&
            weekName.toLowerCase() !== 'null' &&
            weekName !== 'Week' &&
            weekName !== 'ชื่อหน้าชีต' &&
            !weeks.includes(weekName)) {
            weeks.push(weekName);
        }
    });
    return weeks;
}

module.exports = {
    parseCSV,
    parseCSVLine,
    getCell,
    mapOfficers,
    mapWeekData,
    mapWeekNames
};
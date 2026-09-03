/* ========================================
   MHNK Map Module - POI API Routes
   CRUD สำหรับจุดแจ้งบนแผนที่
   ใช้ Google Sheets API (sheet "MapPOI")
   ======================================== */

const { Router } = require('express');
const fs = require('fs');
const path = require('path');

const SHEET_NAME = 'MapPOI';

/** อ่านข้อมูล fallback จาก data/poi-cache.json (ใช้เมื่อไม่มี Google Sheets credentials หรือ Sheets error) */
function readLocalCache() {
  try {
    const cachePath = path.join(__dirname, '..', '..', 'data', 'poi-cache.json');
    if (!fs.existsSync(cachePath)) return null;
    const raw = fs.readFileSync(cachePath, 'utf8').replace(/^\uFEFF/, ''); // ตัด BOM
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
      return parsed.data;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/** สแกนไฟล์ PNG ใน blips/custom/ */
function scanCustomIcons() {
  const iconsDir = path.join(__dirname, '..', 'blips', 'custom');
  try {
    if (!fs.existsSync(iconsDir)) return [];
    return fs.readdirSync(iconsDir)
      .filter(f => f.endsWith('.png') && f.replace(/\.png$/i, '').trim().length > 0)
      .map(f => ({
        id: f.replace(/\.png$/i, ''),
        label: `📌 ${f.replace(/\.png$/i, '')}`,
        file: f
      }));
  } catch (e) {
    return [];
  }
}

/** Helper: ตรวจสอบ/สร้าง Sheet "MapPOI" ถ้ายังไม่มี */
async function ensureSheetExists(sheets, spreadsheetId) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = spreadsheet.data.sheets.some(s => s.properties.title === SHEET_NAME);
  if (exists) return;

  // สร้าง sheet ใหม่
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: SHEET_NAME } } }]
    }
  });

  // ใส่ headers
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!A1:G1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['id', 'name', 'category', 'description', 'x', 'y', 'createdAt']]
    }
  });
}

/**
 * ซ่อม/จัดระเบียบชีต MapPOI ให้เป็นตารางเดียวติดกัน เริ่มที่คอลัมน์ A (A-G)
 * - กู้แถวที่ข้อมูลเพี้ยนไปอยู่คอลัมน์ D-K (ที่เกิดจาก values.append ตรวจจับ table ผิด) กลับมา
 * - ลบแถวว่าง/ข้อมูลขยะที่ค้างออก
 * ใช้สำหรับเรียกครั้งเดียวตอน mount + ผ่าน route /api/poi/repair
 */
async function repairSheet(sheets, sid) {
  // ตรวจสอบว่ามีชีต MapPOI หรือไม่ (ถ้ายังไม่มีก็ไม่มีอะไรต้องซ่อม)
  let spreadsheet;
  try {
    spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sid });
  } catch (e) {
    return { recovered: 0, total: 0 };
  }
  const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === SHEET_NAME);
  if (!sheetExists) return { recovered: 0, total: 0 };

  // อ่านช่วงกว้าง A:K เพื่อจับทั้งแถวปกติ (A-G) และแถวที่เพี้ยน (D-K)
  const read = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: `${SHEET_NAME}!A:K`
  });
  const rows = read.data.values || [];
  if (rows.length === 0) return { recovered: 0, total: 0 };

  const normalized = [];
  let recovered = 0;

  // rows[0] = header (ข้ามไป) เริ่มที่แถวข้อมูล
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];

    // แถวถูกต้อง: col A มี id
    if (row[0] && String(row[0]).trim()) {
      normalized.push([
        String(row[0]).trim(),
        (row[1] || '').toString(),
        (row[2] || '').toString(),
        (row[3] || '').toString(),
        (row[4] || '').toString(),
        (row[5] || '').toString(),
        (row[6] || '').toString()
      ]);
      continue;
    }

    // แถวเพี้ยน (เลื่อนไป D): col D มี id แต่ col A ว่าง
    if (row[3] && String(row[3]).trim()) {
      recovered++;
      normalized.push([
        String(row[3]).trim(),    // id          ← D
        (row[4] || '').toString(), // name       ← E
        (row[5] || '').toString(), // category   ← F
        (row[6] || '').toString(), // description← G
        (row[7] || '').toString(), // x          ← H
        (row[8] || '').toString(), // y          ← I
        (row[9] || '').toString()  // createdAt  ← J
      ]);
      continue;
    }

    // แถวว่าง/ขยะ (ไม่มี id ทั้ง col A และ col D) → ข้าม
  }

  // ล้างทั้งคอลัมน์ A-K (รวมข้อมูลเพี้ยน H-K และแถวว่าง)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sid,
    range: `${SHEET_NAME}!A:K`
  });

  // เขียน header + ข้อมูลที่กู้ได้ กลับเป็น A-G ติดกัน
  const values = [
    ['id', 'name', 'category', 'description', 'x', 'y', 'createdAt'],
    ...normalized
  ];

  if (values.length > 1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sid,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });
  }

  return { recovered, total: normalized.length };
}

function createPoiRoutes(getSheetsFn) {
  const router = Router();

  // ==================== GET /api/poi/categories ====================
  router.get('/categories', (req, res) => {
    const icons = scanCustomIcons();
    res.json({ success: true, data: icons });
  });

  // ==================== POST /api/poi/repair ====================
  // ซ่อมชีต MapPOI: กู้ข้อมูลที่เพี้ยน (D-K) กลับมาเป็น A-G + ลบแถวว่าง
  router.post('/repair', async (req, res) => {
    try {
      const sheets = getSheetsFn();
      const config = require('../../server/config');
      const sid = config.MAP_SHEET_ID || config.SHEET_ID;
      if (!sid) {
        return res.status(500).json({ success: false, error: 'ไม่พบ MAP_SHEET_ID / SHEET_ID' });
      }
      const result = await repairSheet(sheets, sid);
      res.json({ success: true, ...result });
    } catch (err) {
      console.error('[POI] Repair error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==================== GET /api/poi ====================
  router.get('/', async (req, res) => {
    try {
      const sheets = getSheetsFn();
      const config = require('../../server/config');
      const sid = config.MAP_SHEET_ID || config.SHEET_ID;

      // ไม่มี Google Sheets config → ใช้ข้อมูลจาก local cache (เพื่อให้ dev/local ยังเห็นข้อมูลเดิม)
      if (!sid) {
        const cached = readLocalCache();
        if (cached) {
          console.log('[POI] No MAP_SHEET_ID/SHEET_ID, serving local cache (' + cached.length + ' poi)');
          return res.json({ success: true, data: cached });
        }
        return res.json({ success: true, data: [] });
      }

      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sid });
      const sheetExists = spreadsheet.data.sheets.some(s => s.properties.title === SHEET_NAME);

      if (!sheetExists) {
        return res.json({ success: true, data: [] });
      }

      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: sid,
        range: `${SHEET_NAME}!A:G`
      });

      const rows = result.data.values || [];
      if (rows.length <= 1) {
        return res.json({ success: true, data: [] });
      }

      const headers = rows[0];
      const data = rows.slice(1).map(row => {
        const item = {};
        headers.forEach((h, i) => { item[h] = row[i] || ''; });
        return {
          id: item.id,
          name: item.name || '',
          category: item.category || 'custom',
          description: item.description || '',
          x: parseFloat(item.x) || 0,
          y: parseFloat(item.y) || 0,
          createdAt: item.createdAt || new Date().toISOString()
        };
      }).filter(item => item.id);

      res.json({ success: true, data });
    } catch (err) {
      console.error('[POI] GET error:', err.message);
      // Sheets ล้มเหลว (เช่น credentials ไม่ถูกต้อง) → ให้ข้อมูลจาก local cache แทน เพื่อให้หน้าไม่ว่าง
      const cached = readLocalCache();
      if (cached) {
        console.log('[POI] Sheets error, falling back to local cache (' + cached.length + ' poi)');
        return res.json({ success: true, data: cached });
      }
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==================== POST /api/poi ====================
  router.post('/', async (req, res) => {
    try {
      const { name, category, description, x, y } = req.body;

      if (!name || !category || x === undefined || y === undefined) {
        return res.status(400).json({
          success: false,
          error: 'กรุณากรอกข้อมูลให้ครบ: name, category, x, y'
        });
      }

      const sheets = getSheetsFn();
      const config = require('../../server/config');
      const sid = config.MAP_SHEET_ID || config.SHEET_ID;
      const id = require('crypto').randomUUID();

      // ตรวจสอบ/สร้าง sheet ถ้ายังไม่มี
      await ensureSheetExists(sheets, sid);

      // เพิ่มข้อมูล (INSERT_ROWS แทรกเป็นแถวใหม่ท้ายตารางเสมอ ป้องกันข้อมูลหลงคอลัมน์)
      await sheets.spreadsheets.values.append({
        spreadsheetId: sid,
        range: `${SHEET_NAME}!A:G`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[id, name, category, description || '', x, y, new Date().toISOString()]]
        }
      });

      res.json({ success: true, data: { id, name, category, description, x, y } });
    } catch (err) {
      console.error('[POI] POST error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==================== DELETE /api/poi/:id ====================
  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const sheets = getSheetsFn();
      const config = require('../../server/config');
      const sid = config.MAP_SHEET_ID || config.SHEET_ID;

      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: sid,
        range: `${SHEET_NAME}!A:G`
      });

      const rows = result.data.values || [];
      const rowIndex = rows.findIndex(row => row[0] === id);

      if (rowIndex === -1) {
        return res.status(404).json({ success: false, error: 'ไม่พบจุดที่ต้องการลบ' });
      }
      // ป้องกันการลบ header (แถวแรก)
      if (rowIndex < 1) {
        return res.status(400).json({ success: false, error: 'ไม่สามารถลบแถว header ได้' });
      }

      // หา sheetId ของชีต MapPOI (จำเป็นสำหรับ deleteDimension)
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sid });
      const sheet = spreadsheet.data.sheets.find(s => s.properties.title === SHEET_NAME);
      if (!sheet) {
        return res.status(404).json({ success: false, error: 'ไม่พบชีต MapPOI' });
      }

      // ลบแถวจริงออกจากชีต (ไม่ใช้ values.clear ที่ทิ้งแถวว่าง)
      // rows[0] = header = แถวที่ 1 ของชีต; rowIndex คือ zero-based index ในอาร์เรย์
      // แถวเป้าหมาย = แถวที่ (rowIndex+1) ของชีต → deleteDimension startIndex = rowIndex
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sid,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1
              }
            }
          }]
        }
      });

      res.json({ success: true });
    } catch (err) {
      console.error('[POI] DELETE error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==================== AUTO-REPAIR ON MOUNT ====================
  // ซ่อมชีต MapPOI ครั้งเดียวเมื่อ server เริ่ม (idempotent) ให้ข้อมูลกลับเป็น A-G ติดกัน
  (async () => {
    try {
      const sheets = getSheetsFn();
      const config = require('../../server/config');
      const sid = config.MAP_SHEET_ID || config.SHEET_ID;
      if (!sid) return;
      const result = await repairSheet(sheets, sid);
      console.log(`[POI] Sheet repair done. recovered=${result.recovered}, total=${result.total}`);
    } catch (err) {
      console.error('[POI] Sheet auto-repair failed:', err.message);
    }
  })();

  return router;
}

module.exports = createPoiRoutes;
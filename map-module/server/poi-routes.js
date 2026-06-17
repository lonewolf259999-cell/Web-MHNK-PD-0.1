/* ========================================
   MHNK Map Module - POI API Routes
   CRUD สำหรับจุดแจ้งบนแผนที่
   ใช้ Google Sheets API (sheet "MapPOI")
   ======================================== */

const { Router } = require('express');
const fs = require('fs');
const path = require('path');

const SHEET_NAME = 'MapPOI';

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

function createPoiRoutes(getSheetsFn) {
  const router = Router();

  // ==================== GET /api/poi/categories ====================
  router.get('/categories', (req, res) => {
    const icons = scanCustomIcons();
    res.json({ success: true, data: icons });
  });

  // ==================== GET /api/poi ====================
  router.get('/', async (req, res) => {
    try {
      const sheets = getSheetsFn();
      const config = require('../../server/config');
      const sid = config.MAP_SHEET_ID || config.SHEET_ID;

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
      console.error('[POI] GET error:', err);
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

      // เพิ่มข้อมูล
      await sheets.spreadsheets.values.append({
        spreadsheetId: sid,
        range: `${SHEET_NAME}!A:G`,
        valueInputOption: 'USER_ENTERED',
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

      await sheets.spreadsheets.values.clear({
        spreadsheetId: sid,
        range: `${SHEET_NAME}!A${rowIndex + 1}:G${rowIndex + 1}`
      });

      res.json({ success: true });
    } catch (err) {
      console.error('[POI] DELETE error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

module.exports = createPoiRoutes;
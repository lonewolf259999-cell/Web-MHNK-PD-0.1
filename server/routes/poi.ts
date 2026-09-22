import { Elysia, t } from 'elysia';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import poiCache from '@/data/poi-cache.json';
import { config } from '@/server/config';
import { getSheets } from '@/server/services/googleAuth';
import { ApiError } from '@/server/errors';

const SHEET_NAME = 'MapPOI';

export interface Poi {
  id: string;
  name: string;
  category: string;
  description: string;
  x: number;
  y: number;
  createdAt: string;
  dcId: string;
}

/** Snapshot committed to the repo, used when Sheets is unreachable.
    It predates the dcId column, so that field is backfilled as empty. */
function localFallback(): Poi[] | null {
  const data = (poiCache as { data?: Partial<Poi>[] }).data;
  if (!Array.isArray(data) || data.length === 0) return null;

  return data.map((item) => ({
    id: item.id ?? '',
    name: item.name ?? '',
    category: item.category ?? 'custom',
    description: item.description ?? '',
    x: item.x ?? 0,
    y: item.y ?? 0,
    createdAt: item.createdAt ?? new Date().toISOString(),
    dcId: item.dcId ?? '',
  }));
}

/** Custom blip icons ship with the repo; next.config includes them in the bundle. */
function scanCustomIcons() {
  const dir = path.join(process.cwd(), 'public', 'map-module', 'blips', 'custom');
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.png') && f.replace(/\.png$/i, '').trim().length > 0)
      .map((f) => {
        const id = f.replace(/\.png$/i, '');
        return { id, label: `📌 ${id}`, file: f };
      });
  } catch {
    return [];
  }
}

function mapSheetId(): string {
  const sid = config.MAP_SHEET_ID;
  if (!sid) throw new ApiError('ไม่พบ MAP_SHEET_ID / SHEET_ID', 500);
  return sid;
}

async function ensureSheetExists(sid: string) {
  const sheets = getSheets();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sid });
  if (spreadsheet.data.sheets?.some((s) => s.properties?.title === SHEET_NAME)) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sid,
    requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: sid,
    range: `${SHEET_NAME}!A1:G1`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [['id', 'name', 'category', 'description', 'x', 'y', 'createdAt']],
    },
  });
}

/**
 * Rebuilds MapPOI as one contiguous A–G table.
 *
 * values.append used to mis-detect the table edge and write rows starting at
 * column D, so rows are recovered from either position. dcId lives in column J
 * and is preserved separately.
 */
async function repairSheet(sid: string) {
  const sheets = getSheets();

  let spreadsheet;
  try {
    spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sid });
  } catch {
    return { recovered: 0, total: 0 };
  }
  if (!spreadsheet.data.sheets?.some((s) => s.properties?.title === SHEET_NAME)) {
    return { recovered: 0, total: 0 };
  }

  const read = await sheets.spreadsheets.values.get({
    spreadsheetId: sid,
    range: `${SHEET_NAME}!A:K`,
  });
  const rows = read.data.values || [];
  if (rows.length === 0) return { recovered: 0, total: 0 };

  const normalized: string[][] = [];
  let recovered = 0;
  const cell = (row: unknown[], i: number) => (row[i] ?? '').toString();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];

    if (row[0] && String(row[0]).trim()) {
      normalized.push([
        String(row[0]).trim(),
        cell(row, 1),
        cell(row, 2),
        cell(row, 3),
        cell(row, 4),
        cell(row, 5),
        cell(row, 6),
        cell(row, 9),
      ]);
      continue;
    }

    // Shifted row: id landed in column D.
    if (row[3] && String(row[3]).trim()) {
      recovered++;
      normalized.push([
        String(row[3]).trim(),
        cell(row, 4),
        cell(row, 5),
        cell(row, 6),
        cell(row, 7),
        cell(row, 8),
        cell(row, 9),
        '',
      ]);
    }
  }

  await sheets.spreadsheets.values.clear({
    spreadsheetId: sid,
    range: `${SHEET_NAME}!A:G`,
  });

  const values = [
    ['id', 'name', 'category', 'description', 'x', 'y', 'createdAt'],
    ...normalized.map((row) => row.slice(0, 7)),
  ];

  if (values.length > 1) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sid,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });
  }

  if (normalized.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sid,
      range: `${SHEET_NAME}!J2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: normalized.map((row) => [row[7] || '']) },
    });
  }

  return { recovered, total: normalized.length };
}

export const poiRoutes = new Elysia({ name: 'poi', prefix: '/poi' })
  .get('/categories', () => ({ success: true, data: scanCustomIcons() }))

  .post('/repair', async () => ({ success: true, ...(await repairSheet(mapSheetId())) }))

  .get('/', async () => {
    try {
      const sid = mapSheetId();
      const sheets = getSheets();

      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sid });
      if (!spreadsheet.data.sheets?.some((s) => s.properties?.title === SHEET_NAME)) {
        return { success: true, data: [] };
      }

      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: sid,
        range: `${SHEET_NAME}!A:J`,
      });

      const rows = result.data.values || [];
      if (rows.length <= 1) return { success: true, data: [] };

      const headers = rows[0] as string[];
      const data = rows
        .slice(1)
        .map((row) => {
          const item: Record<string, string> = {};
          headers.forEach((h, i) => {
            item[h] = (row[i] ?? '').toString();
          });
          return {
            id: item.id,
            name: item.name || '',
            category: item.category || 'custom',
            description: item.description || '',
            x: parseFloat(item.x) || 0,
            y: parseFloat(item.y) || 0,
            createdAt: item.createdAt || new Date().toISOString(),
            dcId: item.dcId || item['ID DC'] || '',
          };
        })
        .filter((item) => item.id);

      return { success: true, data };
    } catch (err) {
      // Fall back to the committed snapshot so the map still renders.
      const cachedPois = localFallback();
      if (cachedPois) return { success: true, data: cachedPois };
      throw err;
    }
  })

  .post(
    '/',
    async ({ body }) => {
      const sid = mapSheetId();
      const sheets = getSheets();
      const id = randomUUID();

      await ensureSheetExists(sid);

      await sheets.spreadsheets.values.append({
        spreadsheetId: sid,
        range: `${SHEET_NAME}!A:G`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [
            [
              id,
              body.name,
              body.category,
              body.description || '',
              body.x,
              body.y,
              new Date().toISOString(),
            ],
          ],
        },
      });

      if (body.dcId) {
        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: sid,
          range: `${SHEET_NAME}!A:A`,
        });
        const rowCount = (result.data.values || []).length;
        await sheets.spreadsheets.values.update({
          spreadsheetId: sid,
          range: `${SHEET_NAME}!J${rowCount}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[body.dcId]] },
        });
      }

      return { success: true, data: { id, ...body, dcId: body.dcId || '' } };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        category: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
        x: t.Number(),
        y: t.Number(),
        dcId: t.Optional(t.String()),
      }),
    }
  )

  .delete(
    '/:id',
    async ({ params }) => {
      const sid = mapSheetId();
      const sheets = getSheets();

      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: sid,
        range: `${SHEET_NAME}!A:G`,
      });

      const rows = result.data.values || [];
      const rowIndex = rows.findIndex((row) => row[0] === params.id);

      if (rowIndex === -1) throw new ApiError('ไม่พบจุดที่ต้องการลบ', 404);
      if (rowIndex < 1) throw new ApiError('ไม่สามารถลบแถว header ได้', 400);

      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sid });
      const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === SHEET_NAME);
      if (!sheet) throw new ApiError('ไม่พบชีต MapPOI', 404);

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sid,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheet.properties?.sheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1,
                },
              },
            },
          ],
        },
      });

      return { success: true };
    },
    { params: t.Object({ id: t.String() }) }
  )

  .put(
    '/:id',
    async ({ params, body }) => {
      if (!body.name && body.description === undefined) {
        throw new ApiError('กรุณาส่ง name หรือ description ที่ต้องการแก้ไข', 400);
      }

      const sid = mapSheetId();
      const sheets = getSheets();

      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: sid,
        range: `${SHEET_NAME}!A:G`,
      });

      const rows = result.data.values || [];
      const rowIndex = rows.findIndex((row) => row[0] === params.id);
      if (rowIndex === -1) throw new ApiError('ไม่พบจุดที่ต้องการแก้ไข', 404);
      if (rowIndex < 1) throw new ApiError('ไม่สามารถแก้ไขแถว header ได้', 400);

      const updates: { range: string; value: string }[] = [];
      if (body.name !== undefined) {
        updates.push({ range: `${SHEET_NAME}!B${rowIndex + 1}`, value: body.name.trim() });
      }
      if (body.description !== undefined) {
        updates.push({ range: `${SHEET_NAME}!D${rowIndex + 1}`, value: body.description });
      }

      for (const update of updates) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: sid,
          range: update.range,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[update.value]] },
        });
      }

      return { success: true, data: { id: params.id, ...body } };
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        name: t.Optional(t.String()),
        description: t.Optional(t.String()),
      }),
    }
  );

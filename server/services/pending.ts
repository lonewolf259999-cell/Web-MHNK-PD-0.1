/* Pending registration sheet — columns A–H:
   timestamp, discordId, discordName, icName, icPhone, ocAge, steamUrl, status */

import { config } from '@/server/config';
import { getSheets } from './googleAuth';

const STATUS_PENDING = 'รอตรวจ';

export interface PendingRow {
  [key: string]: string | number;
  _row: number;
}

export async function addPendingRegistration(data: {
  discordId: string;
  discordName: string;
  icName: string;
  icPhone: string;
  ocAge: number;
  steamUrl: string;
}): Promise<void> {
  const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

  await getSheets().spreadsheets.values.append({
    spreadsheetId: config.PENDING_SPREADSHEET_ID,
    range: `${config.PENDING_SHEET_NAME}!A:H`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        [
          timestamp,
          data.discordId,
          data.discordName || '',
          data.icName,
          data.icPhone,
          String(data.ocAge),
          data.steamUrl,
          STATUS_PENDING,
        ],
      ],
    },
  });
}

export async function getPendingRegistrations(): Promise<PendingRow[]> {
  const response = await getSheets().spreadsheets.values.get({
    spreadsheetId: config.PENDING_SPREADSHEET_ID,
    range: `${config.PENDING_SHEET_NAME}!A:H`,
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return [];

  const headers = (rows[0] || []) as string[];

  return rows.slice(1).map((row, index) => {
    const item: PendingRow = { _row: index + 2 };
    headers.forEach((header, i) => {
      item[header] = String(row[i] ?? '').trim();
    });
    return item;
  });
}

async function setStatus(rowNumber: number, status: string): Promise<void> {
  await getSheets().spreadsheets.values.update({
    spreadsheetId: config.PENDING_SPREADSHEET_ID,
    range: `${config.PENDING_SHEET_NAME}!H${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] },
  });
}

export const approvePending = (row: number) => setStatus(row, 'อนุมัติ');
export const rejectPending = (row: number) => setStatus(row, 'ปฏิเสธ');

/** Updates columns D–G for whichever row holds this Discord id. */
export async function updatePendingRegistration(
  discordId: string,
  data: { icName: string; icPhone: string; ocAge: number; steamUrl: string }
): Promise<void> {
  const sheets = getSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.PENDING_SPREADSHEET_ID,
    range: `${config.PENDING_SHEET_NAME}!A:H`,
  });

  const rows = response.data.values || [];

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i]?.[1] ?? '').trim() !== discordId) continue;

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.PENDING_SPREADSHEET_ID,
      range: `${config.PENDING_SHEET_NAME}!D${i + 1}:G${i + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[data.icName, data.icPhone, String(data.ocAge), data.steamUrl]],
      },
    });
    return;
  }

  // Not found is expected once a registration has been approved and removed.
}

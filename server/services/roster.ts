/* Roster management — NamePD and OutDC sheets, columns B–N:
   B=phone C=code D=name E=discordId F=rank G=cases H=startDate
   I=days J=lastDuty K=lastTime L=duration M=steam N=status/reason */

import { config } from '@/server/config';
import { getSheets } from './googleAuth';
import { ApiError } from '@/server/errors';

export const EXIT_REASONS = [
  'ออกจาก Discord',
  'ถูกปลดออก',
  'ติดต่อขอออก',
  'เกิน 15 วัน',
] as const;

export type ExitReason = (typeof EXIT_REASONS)[number];

export interface RosterMember {
  row: number;
  code: string;
  name: string;
  phone: string;
  discordId: string;
  rank: string;
  cases: string;
  startDate: string;
  days: string;
  lastDuty: string;
  lastTime: string;
  duration: string;
  steam: string;
  status: string;
}

function mapMembers(rows: string[][]): RosterMember[] {
  const cell = (row: string[], i: number) => (row[i] ?? '').trim();
  const members: RosterMember[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const code = cell(row, 1);
    if (!code || code.length > 3 || !/^\d+$/.test(code)) continue;

    const name = cell(row, 2);
    if (!name) continue;

    members.push({
      row: i + 1,
      code,
      name,
      phone: cell(row, 0),
      discordId: cell(row, 3),
      rank: cell(row, 4),
      cases: cell(row, 5),
      startDate: cell(row, 6),
      days: cell(row, 7),
      lastDuty: cell(row, 8),
      lastTime: cell(row, 9),
      duration: cell(row, 10),
      steam: cell(row, 11),
      status: cell(row, 12),
    });
  }

  return members;
}

async function readSheet(sheetName: string): Promise<RosterMember[]> {
  const response = await getSheets().spreadsheets.values.get({
    spreadsheetId: config.ROSTER_SHEET_ID,
    range: `${sheetName}!B:N`,
  });
  return mapMembers((response.data.values as string[][]) || []);
}

export const getNamePDMembers = () => readSheet(config.ROSTER_SHEET_NAME);
export const getOutDCMembers = () => readSheet(config.ROSTER_OUT_SHEET_NAME);

export async function updateStatus(row: number, status: string): Promise<void> {
  await getSheets().spreadsheets.values.update({
    spreadsheetId: config.ROSTER_SHEET_ID,
    range: `${config.ROSTER_SHEET_NAME}!N${row}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[status]] },
  });
}

/** First blank row in OutDC from row 3 down, judged by the name column. */
async function findEmptyOutDCRow(): Promise<number> {
  const res = await getSheets().spreadsheets.values.get({
    spreadsheetId: config.ROSTER_SHEET_ID,
    range: `${config.ROSTER_OUT_SHEET_NAME}!D3:D`,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const rows = res.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i]?.[0] || !String(rows[i][0]).trim()) return 3 + i;
  }
  return 3 + rows.length;
}

export async function moveToOutDC(row: number, reason: ExitReason) {
  const sheets = getSheets();

  const source = await sheets.spreadsheets.values.get({
    spreadsheetId: config.ROSTER_SHEET_ID,
    range: `${config.ROSTER_SHEET_NAME}!B${row}:N${row}`,
  });

  const values = source.data.values?.[0];
  if (!values || values.length < 13) {
    throw new ApiError('ไม่พบข้อมูลแถวนี้ใน NamePD', 404);
  }

  const [phone, code, name, discordId, rank, cases, startDate, days, lastDuty, lastTime, duration, steam, status] =
    values as string[];

  // The sheet's own status column wins when set; the request's reason is the fallback.
  const finalReason = status || reason;
  const targetRow = await findEmptyOutDCRow();

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.ROSTER_SHEET_ID,
    range: `${config.ROSTER_OUT_SHEET_NAME}!B${targetRow}:N${targetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [
        [
          phone, code, name, discordId, rank, cases,
          startDate, days, lastDuty, lastTime, duration, steam, finalReason,
        ],
      ],
    },
  });

  /* Clear the vacated NamePD cells. C (code), F (rank), I (days) and
     L (duration) are deliberately kept. One batchClear replaces the 16
     sequential writes the v2 service made. */
  const columns = ['B', 'D', 'E', 'G', 'H', 'J', 'K', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U'];

  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: config.ROSTER_SHEET_ID,
    requestBody: {
      ranges: columns.map((col) => `${config.ROSTER_SHEET_NAME}!${col}${row}`),
    },
  });

  return { code, name, discordId };
}

/** Announces a departure in Discord. Failure is reported, never thrown. */
export async function sendExitWebhook(
  reason: ExitReason,
  discordId: string
): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = config.DISCORD_OUTPD_WEBHOOK_URL;
  if (!webhookUrl) return { success: false, error: 'DISCORD_OUTPD_WEBHOOK_URL not configured' };

  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const label = reason === 'ถูกปลดออก' ? 'ถูกปลดออก' : 'ลาออก';

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `<@${discordId}>`,
        embeds: [
          {
            title: '📢 ประกาศลาออกจากการเป็นเจ้าหน้าที่',
            description:
              `ต่อจากนี้ คุณ <@${discordId}> ได้${label}จากการเป็นเจ้าหน้าที่\n` +
              `ต่อจากนี้การกระทำใดๆก็แล้วแต่จะไม่ข้องเกี่ยวกับ สน อีกต่อไป\n\n` +
              `ณ วันที่ ${dateStr} (คูลดาวน์ 1 วัน)\n\nขอบคุณสำหรับการทำงานที่ผ่านมา`,
            color: reason === 'ถูกปลดออก' ? 0xef4444 : 0x3b82f6,
            timestamp: now.toISOString(),
          },
        ],
      }),
      signal: AbortSignal.timeout(config.REQUEST_TIMEOUT),
    });

    return res.ok ? { success: true } : { success: false, error: `status=${res.status}` };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

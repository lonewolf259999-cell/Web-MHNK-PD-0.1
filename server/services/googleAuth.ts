/* Google Sheets client — one instance per serverless container */

import { google, type sheets_v4 } from 'googleapis';

let client: sheets_v4.Sheets | null = null;

export function getSheets(): sheets_v4.Sheets {
  if (client) return client;

  const rawKey = process.env.GOOGLE_JSON_KEY;
  if (!rawKey) {
    throw new Error('GOOGLE_JSON_KEY is not set');
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(rawKey);
  } catch {
    throw new Error('GOOGLE_JSON_KEY is not valid JSON');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  client = google.sheets({ version: 'v4', auth });
  return client;
}

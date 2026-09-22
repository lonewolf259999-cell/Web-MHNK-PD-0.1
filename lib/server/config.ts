/* Environment configuration — read once per serverless instance */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  get SHEET_ID() {
    return required('SHEET_ID');
  },
  get CASES_SHEET_ID() {
    return required('CASES_SHEET_ID');
  },
  get RULES_SHEET_ID() {
    return required('RULES_SHEET_ID');
  },
  get ADMIN_PIN() {
    return required('ADMIN_PIN');
  },

  CASES_DATA_SHEET_ID:
    process.env.CASES_DATA_SHEET_ID || '1grpNtG3sa9UoSwmTU3tY7-FOZQEHcMvL-Vu_1ipULlI',
  get MAP_SHEET_ID() {
    return process.env.MAP_SHEET_ID || process.env.SHEET_ID || '';
  },
  get PENDING_SPREADSHEET_ID() {
    return process.env.PENDING_SPREADSHEET_ID || process.env.SHEET_ID || '';
  },
  get ROSTER_SHEET_ID() {
    return process.env.ROSTER_SHEET_ID || process.env.SHEET_ID || '';
  },

  SHEET_NAME: 'NamePD',
  CASES_SHEET_NAME: 'CaseAll',
  CONDUCT_SHEET_NAME: 'conduct',
  RULES_SHEET_NAME: 'rules',
  FINES_SHEET_NAME: 'fines',
  PENDING_SHEET_NAME: process.env.PENDING_SHEET_NAME || 'Pending',
  ROSTER_SHEET_NAME: 'NamePD',
  ROSTER_OUT_SHEET_NAME: 'OutDC',

  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || '',
  DISCORD_REGISTER_WEBHOOK_URL: process.env.DISCORD_REGISTER_WEBHOOK_URL || '',
  DISCORD_COUNCIL_WEBHOOK_URL: process.env.DISCORD_COUNCIL_WEBHOOK_URL || '',
  DISCORD_MEDICAL_WEBHOOK_URL: process.env.DISCORD_MEDICAL_WEBHOOK_URL || '',
  DISCORD_PROCTOR_WEBHOOK_URL: process.env.DISCORD_PROCTOR_WEBHOOK_URL || '',
  DISCORD_OUTPD_WEBHOOK_URL: process.env.DISCORD_OUTPD_WEBHOOK_URL || '',

  APP_URL: process.env.APP_URL || 'http://localhost:3000',

  CACHE_TTL: 15_000,
  REQUEST_TIMEOUT: 10_000,
} as const;

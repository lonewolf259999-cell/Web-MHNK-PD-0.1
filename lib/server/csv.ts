/* CSV parsing + row mappers for the Google Sheets GViz export */

import type { Officer, WeekData } from '@/lib/types';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function parseCSV(csvText: string): string[][] {
  return csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCSVLine);
}

function getCell(row: string[] | undefined, index: number): string {
  if (!row || index >= row.length) return '';
  return (row[index] || '').replace(/^"|"$/g, '').trim();
}

/** NamePD sheet: C=code, D=name, F=rank, G=cases, I=workDays, L=daysAway, M=steamKey, O–U=schedule */
export function mapOfficers(rows: string[][]): Officer[] {
  const officers: Officer[] = [];

  for (const row of rows) {
    const code = getCell(row, 2);
    if (!code || code.length > 3 || !/^[0-9]+$/.test(code)) continue;

    const name = getCell(row, 3);
    if (!name) continue;

    const schedule: string[] = [];
    for (let d = 0; d < 7; d++) schedule.push(getCell(row, 14 + d));

    officers.push({
      code,
      name,
      phone: getCell(row, 1),
      rank: getCell(row, 5),
      cases: getCell(row, 6),
      steamId: getCell(row, 12),
      workDays: getCell(row, 8),
      daysAway: getCell(row, 11),
      steamKey: getCell(row, 12),
      fullName: `${code} ${name}`,
      schedule,
    });
  }

  return officers;
}

/** Weekly sheet: A=name, C=take2, D=weeklyCases, F=interrogations, H=rank, J=totalCases, U=salary, X=paid, AC–AI=duty, AJ=total */
export function mapWeekData(rows: string[][]): WeekData {
  const data: WeekData = {};

  for (const row of rows) {
    const name = getCell(row, 0);
    if (!name || name === 'ชื่อ-นามสกุล') continue;

    const salaryRaw = getCell(row, 20).replace(/[^0-9.]/g, '');

    data[name] = {
      name,
      rank: getCell(row, 7),
      take2: getCell(row, 2),
      weeklyCases: getCell(row, 3),
      interrogations: getCell(row, 5),
      totalCases: getCell(row, 9),
      totalAmount: parseFloat(salaryRaw) || 0,
      paid: getCell(row, 23),
      duty: [28, 29, 30, 31, 32, 33, 34].map((i) => getCell(row, i)),
      dutyTotal: getCell(row, 35),
    };
  }

  return data;
}

/** CaseAll sheet, column H holds the week tab names. */
export function mapWeekNames(rows: string[][]): string[] {
  const weeks: string[] = [];
  const skip = new Set(['', 'null', 'week', 'ชื่อหน้าชีต']);

  for (const row of rows) {
    const weekName = getCell(row, 7);
    if (!weekName || skip.has(weekName.toLowerCase()) || weeks.includes(weekName)) continue;
    weeks.push(weekName);
  }

  return weeks;
}

import {
  cellValue,
  emptyParseLog,
  loadWorksheetRows,
  normalizeSid,
  type ParseLog,
} from "./helpers";

export interface RosterRow {
  sid: string;
  nameFull: string;
  roomCode: string;
  bedNo?: string;
  gender?: string;
  programYear?: number;
  program?: string;
  country?: string;
  checkIn?: Date;
  checkOut?: Date;
  status?: string;
  rowIndex: number;
}

export interface RosterParseResult {
  rows: RosterRow[];
  log: ParseLog;
}

function parseDate(val: unknown): Date | undefined {
  if (val instanceof Date) return val;
  const s = cellValue(val);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function parseRosterSheet(
  buffer: Buffer,
  sheetName?: string,
): Promise<RosterParseResult> {
  const { rows, usedSheet } = await loadWorksheetRows(buffer, sheetName);
  const log = emptyParseLog();
  const result: RosterRow[] = [];

  let startRow = 0;
  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const sid = normalizeSid(rows[r]?.[3]);
    if (sid.length >= 7) {
      startRow = r;
      break;
    }
  }

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    const sid = normalizeSid(row[3] ?? row[2]);
    if (!sid || sid.length < 7) continue;

    const roomRaw = cellValue(row[1]);
    if (!roomRaw.startsWith("SR")) continue;

    result.push({
      sid,
      nameFull: cellValue(row[4] ?? row[3]),
      roomCode: roomRaw,
      bedNo: cellValue(row[2]) || undefined,
      gender: cellValue(row[5]) || undefined,
      programYear: parseInt(cellValue(row[6]), 10) || undefined,
      program: cellValue(row[7]) || undefined,
      country: cellValue(row[8]) || undefined,
      checkIn: parseDate(row[9]),
      checkOut: parseDate(row[10]),
      status: cellValue(row[11]) || undefined,
      rowIndex: r + 1,
    });
    log.matched++;
  }

  if (result.length === 0) {
    log.warnings.push(`No roster rows parsed from sheet ${usedSheet}`);
  }

  return { rows: result, log };
}

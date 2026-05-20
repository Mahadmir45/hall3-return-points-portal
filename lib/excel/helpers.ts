import { formatSid } from "@/lib/utils";

export function cellValue(val: unknown): string {
  if (val == null) return "";
  if (val instanceof Date) return val.toISOString();
  return String(val).trim();
}

export function cellNumber(val: unknown): number {
  const s = cellValue(val);
  if (!s || s.toLowerCase() === "na" || s.includes("add above")) return 0;
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function findRowContaining(
  rows: unknown[][],
  needles: string[],
  startRow = 0,
): number {
  for (let r = startRow; r < rows.length; r++) {
    const rowText = rows[r].map(cellValue).join(" ").toLowerCase();
    if (needles.every((n) => rowText.includes(n.toLowerCase()))) return r;
  }
  return -1;
}

export function findColumnIndex(
  headerRow: unknown[],
  needle: string,
  startCol = 0,
): number {
  const lower = needle.toLowerCase();
  for (let c = startCol; c < headerRow.length; c++) {
    if (cellValue(headerRow[c]).toLowerCase().includes(lower)) return c;
  }
  return -1;
}

/** Match header cell exactly (case-insensitive), not substring — avoids "Tentative no. of participants". */
export function findExactColumnIndex(
  headerRow: unknown[],
  candidates: string[],
  startCol = 0,
): number {
  for (let c = startCol; c < headerRow.length; c++) {
    const v = cellValue(headerRow[c]).toLowerCase().replace(/\s+/g, " ").trim();
    for (const cand of candidates) {
      if (v === cand.toLowerCase()) return c;
    }
  }
  return -1;
}

export interface BandColumns {
  nameCol: number;
  sidCol: number;
  roomCol: number;
  ptsCol: number;
  ratingCol: number;
}

/** Resolve OC / Helper / Participant column bands from a header row. */
export function resolveBandColumns(
  header: unknown[],
  nameCol: number,
  nextBandStart?: number,
): BandColumns | null {
  if (nameCol < 0) return null;

  const end = nextBandStart ?? header.length;
  let sidCol = -1;
  let roomCol = -1;
  let ptsCol = -1;
  let ratingCol = -1;

  for (let c = nameCol + 1; c < end; c++) {
    const h = cellValue(header[c]).toLowerCase();
    if (!h) continue;
    if (sidCol < 0 && h.includes("sid")) sidCol = c;
    else if (roomCol < 0 && h.includes("room")) roomCol = c;
    else if (ptsCol < 0 && h.includes("gained pt")) ptsCol = c;
    else if (ratingCol < 0 && h === "rating") ratingCol = c;
  }

  // Positional fallback when participant band has no SID/Room headers (Welcome Party layout)
  if (sidCol < 0) sidCol = nameCol + 1;
  if (roomCol < 0) roomCol = nameCol + 2;
  if (ptsCol < 0) ptsCol = nameCol + 3;
  if (ratingCol < 0) ratingCol = ptsCol + 1;

  return { nameCol, sidCol, roomCol, ptsCol, ratingCol };
}

export function looksLikeSid(val: unknown): boolean {
  const s = normalizeSid(val);
  return s.length >= 7 && s.length <= 10;
}

export function normalizeSid(val: unknown): string {
  return formatSid(cellValue(val));
}

export interface ParseLog {
  headerRow?: number;
  matched: number;
  unresolved: { row: number; rawName?: string; rawSid?: string }[];
  warnings: string[];
  errors: string[];
}

export function emptyParseLog(): ParseLog {
  return { matched: 0, unresolved: [], warnings: [], errors: [] };
}

export async function loadWorksheetRows(
  buffer: Buffer,
  sheetName?: string,
): Promise<{ rows: unknown[][]; sheetNames: string[]; usedSheet: string }> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  const sheet =
    (sheetName ? workbook.getWorksheet(sheetName) : null) ??
    workbook.worksheets[0];

  if (!sheet) throw new Error("No worksheet found");

  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const vals: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      vals[colNumber - 1] = cell.value;
    });
    rows.push(vals);
  });

  return { rows, sheetNames, usedSheet: sheet.name };
}

export function matchStudentBySid(
  sid: string,
  students: { id: string; sid: string }[],
): string | null {
  const normalized = normalizeSid(sid);
  if (!normalized) return null;
  const found = students.find((s) => normalizeSid(s.sid) === normalized);
  return found?.id ?? null;
}

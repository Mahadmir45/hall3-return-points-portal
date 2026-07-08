import type { RoleCode } from "@prisma/client";
import {
  cellValue,
  emptyParseLog,
  findTotalPointsColumn,
  loadWorksheetRows,
  looksLikeSid,
  normalizeSid,
  type ParseLog,
} from "./helpers";

export interface StagedHsoEntry {
  officerName: string;
  officerSid?: string;
  officerRoom?: string;
  points: number;
  notes?: string;
  rowIndex: number;
}

export interface HsoParseResult {
  entries: StagedHsoEntry[];
  log: ParseLog;
}

function extractPoints(val: unknown): number {
  const s = cellValue(val);
  if (!s) return 0;

  const lower = s.toLowerCase();
  if (lower.includes("absent") && !/^\d/.test(s)) return 0;
  if (lower.includes("not available") && !/^\d/.test(s)) return 0;

  const m = s.match(/^[\d.]+/);
  if (m) return parseFloat(m[0]);
  if (/^0\b/.test(s.trim())) return 0;

  return 0;
}

function normalizeNameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isOfficerRosterHeader(row: unknown[]): boolean {
  return (
    cellValue(row[2]).toLowerCase() === "name" &&
    cellValue(row[7]).toLowerCase() === "position"
  );
}

function isMentorNameRow(row: unknown[]): boolean {
  return (
    cellValue(row[6]).toLowerCase() === "name" &&
    cellValue(row[7]).length > 2 &&
    !/^\d+$/.test(cellValue(row[7]))
  );
}

function isMentorTaskHeaderRow(row: unknown[]): boolean {
  const tasks = cellValue(row[5]).toLowerCase();
  const rt = cellValue(row[4]).toLowerCase();
  return tasks === "tasks" && rt.includes("rt mentor");
}

function isSectionTitleRow(row: unknown[]): boolean {
  const name = cellValue(row[2]);
  const sid = cellValue(row[3]);
  if (!name || sid) return false;
  return /officer$/i.test(name) || /^[A-Za-z ]+ Officer$/i.test(name);
}

function isPointColumnHeader(label: string): boolean {
  const lower = label.toLowerCase();
  if (!label) return false;
  if (lower === "f" || lower === "floor" || lower === "position") return false;
  if (lower.includes("name") || lower.includes("sid")) return false;
  if (lower.includes("comment") || lower.includes("note")) return false;
  return (
    lower.includes("meeting") ||
    lower.includes("umbrella") ||
    lower.includes("task") ||
    /\(\d{1,2}\/\d{1,2}\)/.test(label) ||
    /\d{1,2}\/\d{1,2}/.test(label)
  );
}

/** Horizontal officer roster: one row per person → name, SID, total points. */
function parseHorizontalOfficerRoster(
  rows: unknown[][],
  log: ParseLog,
): { entries: StagedHsoEntry[]; sidByName: Map<string, string> } {
  const entries: StagedHsoEntry[] = [];
  const sidByName = new Map<string, string>();
  const headerRowIdx = rows.findIndex(isOfficerRosterHeader);
  if (headerRowIdx < 0) return { entries, sidByName };

  const header = rows[headerRowIdx] ?? [];
  const totalCol = findTotalPointsColumn(header);
  const meetingCols: { col: number; label: string }[] = [];

  for (let c = 0; c < header.length; c++) {
    const label = cellValue(header[c]).replace(/\s+/g, " ").trim();
    if (!label || c === totalCol) continue;
    if (isPointColumnHeader(label)) meetingCols.push({ col: c, label });
  }

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    if (isMentorNameRow(row) || cellValue(row[6]).toLowerCase() === "rt mentors") {
      break;
    }
    if (isSectionTitleRow(row)) continue;

    const name = cellValue(row[2]);
    const sid = cellValue(row[3]);
    if (!name || !looksLikeSid(sid)) continue;

    const room = cellValue(row[6]);
    sidByName.set(normalizeNameKey(name), normalizeSid(sid));

    let total = totalCol >= 0 ? extractPoints(row[totalCol]) : 0;
    if (total === 0) {
      for (const mc of meetingCols) total += extractPoints(row[mc.col]);
    }
    if (total === 0) continue;

    entries.push({
      officerName: name,
      officerSid: normalizeSid(sid),
      officerRoom: room,
      points: total,
      rowIndex: r + 1,
    });
    log.matched++;
  }

  return { entries, sidByName };
}

/** Vertical mentor matrix: one column per person → name header, total points summed down the column. */
function parseVerticalMentorColumns(
  rows: unknown[][],
  sidByName: Map<string, string>,
  log: ParseLog,
): StagedHsoEntry[] {
  const entries: StagedHsoEntry[] = [];
  const nameRowIdx = rows.findIndex(isMentorNameRow);
  if (nameRowIdx < 0) return entries;

  const nameRow = rows[nameRowIdx] ?? [];
  const roomRow = rows[nameRowIdx + 2] ?? [];
  const positionRowIdx = rows.findIndex(
    (row, idx) => idx > nameRowIdx && isMentorTaskHeaderRow(row),
  );
  if (positionRowIdx < 0) {
    log.errors.push("Could not find HSO mentor task header");
    return entries;
  }

  const mentors: { col: number; name: string; room?: string; sid?: string }[] =
    [];

  for (let c = 7; c < nameRow.length; c++) {
    const name = cellValue(nameRow[c]);
    if (!name || name.length < 3) continue;
    if (/comment|note|timmy|miya|queenie|iris|mahad/i.test(name) && !name.includes(" ")) {
      continue;
    }
    mentors.push({
      col: c,
      name,
      room: cellValue(roomRow[c]),
      sid: sidByName.get(normalizeNameKey(name)),
    });
  }

  if (mentors.length === 0) {
    log.errors.push("Could not find HSO mentor names");
    return entries;
  }

  for (const mentor of mentors) {
    let total = 0;
    for (let r = positionRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const task = cellValue(row[5]);
      if (!task || task.toLowerCase() === "tasks") continue;
      const raw = cellValue(row[mentor.col]);
      if (!raw) continue;
      const points = extractPoints(raw);
      if (points === 0 && !/[(\d)]/.test(raw)) continue;
      total += points;
    }

    if (total === 0) continue;

    entries.push({
      officerName: mentor.name,
      officerSid: mentor.sid,
      officerRoom: mentor.room,
      points: total,
      rowIndex: nameRowIdx + 1,
    });
    log.matched++;
  }

  return entries;
}

export async function parseHsoSheet(
  buffer: Buffer,
  sheetName?: string,
): Promise<HsoParseResult> {
  const { rows } = await loadWorksheetRows(buffer, sheetName);
  const log = emptyParseLog();

  const { entries: officerEntries, sidByName } = parseHorizontalOfficerRoster(
    rows,
    log,
  );
  const mentorEntries = parseVerticalMentorColumns(rows, sidByName, log);

  // Prefer vertical mentor totals when the same person appears in both sections
  const byKey = new Map<string, StagedHsoEntry>();
  for (const e of [...officerEntries, ...mentorEntries]) {
    const key = e.officerSid ?? normalizeNameKey(e.officerName);
    const existing = byKey.get(key);
    if (!existing || e.points > existing.points) {
      byKey.set(key, {
        ...e,
        officerSid: e.officerSid ?? existing?.officerSid,
        officerRoom: e.officerRoom ?? existing?.officerRoom,
      });
    }
  }

  const entries = Array.from(byKey.values());

  if (entries.length === 0 && log.errors.length === 0) {
    log.errors.push("Could not find HSO sheet structure");
  }

  return { entries, log };
}

export function hsoEntriesToParticipants(
  entries: StagedHsoEntry[],
): {
  rawName?: string;
  rawSid?: string;
  rawRoom?: string;
  roleCode: RoleCode;
  basePoints: number;
  computedPoints: number;
  notes?: string;
  rowIndex: number;
}[] {
  return entries.map((e) => ({
    rawName: e.officerName,
    rawSid: e.officerSid,
    rawRoom: e.officerRoom,
    roleCode: "OFFICER" as RoleCode,
    basePoints: e.points,
    computedPoints: e.points,
    notes: e.notes,
    rowIndex: e.rowIndex,
  }));
}

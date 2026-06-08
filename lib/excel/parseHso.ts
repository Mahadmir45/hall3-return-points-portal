import type { RoleCode } from "@prisma/client";
import {
  cellValue,
  emptyParseLog,
  loadWorksheetRows,
  looksLikeSid,
  type ParseLog,
} from "./helpers";

export interface StagedHsoEntry {
  officerName: string;
  officerSid?: string;
  officerRoom?: string;
  taskLabel: string;
  rtMentor?: string;
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

  // Use leading number only — avoid cellNumber which merges "4(3+1)" into 431
  const leading = extractLeadingNumber(s);
  if (leading > 0) return leading;

  // Explicit zero entries like "0" or "0 (claim)"
  if (/^0\b/.test(s.trim())) return 0;

  return 0;
}

function extractLeadingNumber(s: string): number {
  const m = s.match(/^[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
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

function parseOfficerRoster(rows: unknown[][], log: ParseLog): StagedHsoEntry[] {
  const entries: StagedHsoEntry[] = [];
  const headerRowIdx = rows.findIndex(isOfficerRosterHeader);
  if (headerRowIdx < 0) return entries;

  const header = rows[headerRowIdx] ?? [];
  const meetingCols: { col: number; label: string }[] = [];
  for (let c = 8; c < header.length; c++) {
    const label = cellValue(header[c]);
    if (!label) continue;
    const lower = label.toLowerCase();
    if (lower.includes("total") || lower === "f") break;
    meetingCols.push({ col: c, label: label.replace(/\s+/g, " ").trim() });
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
    const position = cellValue(row[7]);

    let total = 0;
    const meetingNotes: string[] = [];
    for (const mc of meetingCols) {
      const raw = cellValue(row[mc.col]);
      if (!raw) continue;
      const pts = extractPoints(row[mc.col]);
      total += pts;
      meetingNotes.push(`${mc.label}: ${raw}`);
    }

    if (total === 0 && meetingNotes.length === 0) continue;

    entries.push({
      officerName: name,
      officerSid: sid,
      officerRoom: room,
      taskLabel: position || "HSO Officer",
      rtMentor: undefined,
      points: total,
      notes: meetingNotes.join("; "),
      rowIndex: r + 1,
    });
    log.matched++;
  }

  return entries;
}

function parseMentorMatrix(rows: unknown[][], log: ParseLog): StagedHsoEntry[] {
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

  const positionRow = rows[positionRowIdx] ?? [];
  const mentors: {
    col: number;
    name: string;
    room?: string;
    position?: string;
  }[] = [];

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
      position: cellValue(positionRow[c]),
    });
  }

  if (mentors.length === 0) {
    log.errors.push("Could not find HSO mentor names");
    return entries;
  }

  for (let r = positionRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    const task = cellValue(row[5]);
    if (!task || task.toLowerCase() === "tasks") continue;

    const rtMentor = cellValue(row[4]) || cellValue(row[2]);
    const sectionLabel = cellValue(row[2]);
    const rtLabel = rtMentor || sectionLabel;

    for (const mentor of mentors) {
      const raw = cellValue(row[mentor.col]);
      if (!raw) continue;

      const points = extractPoints(raw);
      if (points === 0 && !/[(\d)]/.test(raw)) continue;

      entries.push({
        officerName: mentor.name,
        officerSid: undefined,
        officerRoom: mentor.room,
        taskLabel: task,
        rtMentor: rtLabel,
        points,
        notes: raw,
        rowIndex: r + 1,
      });
      log.matched++;
    }
  }

  return entries;
}

export async function parseHsoSheet(
  buffer: Buffer,
  sheetName?: string,
): Promise<HsoParseResult> {
  const { rows } = await loadWorksheetRows(buffer, sheetName);
  const log = emptyParseLog();

  const mentorEntries = parseMentorMatrix(rows, log);
  const officerEntries = parseOfficerRoster(rows, log);

  const entries = [...mentorEntries, ...officerEntries];

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
  sessionData?: Record<string, unknown>;
}[] {
  const byOfficer = new Map<
    string,
    {
      rawName: string;
      rawSid?: string;
      rawRoom?: string;
      total: number;
      tasks: string[];
      rowIndex: number;
    }
  >();

  for (const e of entries) {
    const key = e.officerSid ?? e.officerName.toLowerCase();
    const existing = byOfficer.get(key) ?? {
      rawName: e.officerName,
      rawSid: e.officerSid,
      rawRoom: e.officerRoom,
      total: 0,
      tasks: [],
      rowIndex: e.rowIndex,
    };
    existing.total += e.points;
    existing.tasks.push(`${e.taskLabel}: ${e.notes ?? e.points}`);
    if (!existing.rawRoom && e.officerRoom) existing.rawRoom = e.officerRoom;
    byOfficer.set(key, existing);
  }

  return Array.from(byOfficer.values()).map((o) => ({
    rawName: o.rawName,
    rawSid: o.rawSid,
    rawRoom: o.rawRoom,
    roleCode: "OFFICER" as RoleCode,
    basePoints: o.total,
    computedPoints: o.total,
    notes: o.tasks.join("; "),
    rowIndex: o.rowIndex,
    sessionData: { tasks: o.tasks },
  }));
}

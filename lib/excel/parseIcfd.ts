import type { RoleCode, SessionType } from "@prisma/client";
import {
  cellNumber,
  cellValue,
  emptyParseLog,
  findRowContaining,
  loadWorksheetRows,
  type ParseLog,
} from "./helpers";

export interface StagedSession {
  label: string;
  type: SessionType;
  sessionDate?: Date;
  sortOrder: number;
}

export interface StagedIcfdParticipant {
  rawName?: string;
  rawSid?: string;
  rawRoom?: string;
  roleCode: RoleCode;
  basePoints: number;
  extraPoints: number;
  computedPoints: number;
  rowIndex: number;
  attendance: Record<string, boolean>;
  notes?: string;
}

export interface IcfdParseResult {
  participants: StagedIcfdParticipant[];
  sessions: StagedSession[];
  log: ParseLog;
}

function parseSessionLabel(label: string): { type: SessionType; date?: Date } {
  const lower = label.toLowerCase();
  const type: SessionType = lower.includes("competition")
    ? "COMPETITION"
    : lower.includes("training")
      ? "TRAINING"
      : "OTHER";

  const dateMatch = label.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  let date: Date | undefined;
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
    date = new Date(year, parseInt(m, 10) - 1, parseInt(d, 10));
  }
  return { type, date };
}

function mapRoleTag(tag: string): RoleCode {
  const lower = tag.toLowerCase();
  if (lower.includes("team manager")) return "TEAM_MANAGER";
  if (lower.includes("player")) return "PLAYER";
  if (lower.includes("backup")) return "BACKUP";
  if (lower.includes("cheering")) return "CHEERING";
  if (lower.includes("unselected")) return "UNSELECTED";
  return "PLAYER";
}

export async function parseIcfdSheet(
  buffer: Buffer,
  sheetName?: string,
): Promise<IcfdParseResult> {
  const { rows } = await loadWorksheetRows(buffer, sheetName);
  const log = emptyParseLog();
  const sessions: StagedSession[] = [];
  const participants: StagedIcfdParticipant[] = [];

  const sessionHeaderRow = findRowContaining(rows, ["training", "competition"]);
  if (sessionHeaderRow < 0) {
    const altRow = findRowContaining(rows, ["participation points"]);
    if (altRow < 0) {
      log.errors.push("Could not find ICFD session header");
      return { participants, sessions, log };
    }
  }

  const headerRowIdx =
    sessionHeaderRow >= 0 ? sessionHeaderRow : findRowContaining(rows, ["participation points"]) - 1;

  const header = rows[headerRowIdx] ?? [];
  const sessionCols: { col: number; label: string }[] = [];

  for (let c = 0; c < header.length; c++) {
    const label = cellValue(header[c]);
    if (
      label.toLowerCase().includes("training") ||
      label.toLowerCase().includes("competition")
    ) {
      const { type, date } = parseSessionLabel(label);
      sessions.push({
        label,
        type,
        sessionDate: date,
        sortOrder: sessionCols.length,
      });
      sessionCols.push({ col: c, label });
    }
  }

  const dataStartRow = findRowContaining(rows, ["player", "sid"], headerRowIdx + 1);
  const startRow = dataStartRow >= 0 ? dataStartRow : headerRowIdx + 2;

  let currentRole: RoleCode = "PLAYER";

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    const tag = cellValue(row[0]) || cellValue(row[1]);
    if (tag && !cellValue(row[2]) && tag.match(/manager|player|backup|cheering|unselected/i)) {
      currentRole = mapRoleTag(tag);
      continue;
    }

    const no = cellValue(row[0]);
    const nameOrRole = cellValue(row[1]);
    const sidVal = cellValue(row[2]) || cellValue(row[3]);
    const roomVal = cellValue(row[3]) || cellValue(row[4]);

    if (!sidVal && !nameOrRole) continue;
    if (nameOrRole.toLowerCase() === "sid") continue;

    const name = sidVal.match(/^\d/) ? nameOrRole : nameOrRole;
    const sid = sidVal.match(/^\d/) ? sidVal : cellValue(row[2]);
    const room = roomVal;

    const attendance: Record<string, boolean> = {};
    for (const sc of sessionCols) {
      const val = cellValue(row[sc.col]).toUpperCase();
      attendance[sc.label] = val === "Y" || val === "YES" || val === "1";
    }

    const partPtsCol = findLastNumericColumn(row, "participation");
    const extraPtsCol = partPtsCol + 1;
    const subTotalCol = row.length - 1;

    const basePoints = cellNumber(row[partPtsCol >= 0 ? partPtsCol : row.length - 4]);
    const extraPoints = cellNumber(row[extraPtsCol]);
    const computedPoints =
      cellNumber(row[subTotalCol]) || basePoints + extraPoints;

    participants.push({
      rawName: name,
      rawSid: sid,
      rawRoom: room,
      roleCode: currentRole,
      basePoints,
      extraPoints,
      computedPoints,
      rowIndex: r + 1,
      attendance,
      notes: no ? `Row ${no}` : undefined,
    });
    log.matched++;
  }

  return { participants, sessions, log };
}

function findLastNumericColumn(row: unknown[], hint: string): number {
  for (let c = row.length - 1; c >= 0; c--) {
    const v = cellValue(row[c]);
    if (v.toLowerCase().includes(hint)) return c;
  }
  return -1;
}

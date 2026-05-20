import type { RoleCode } from "@prisma/client";
import {
  cellNumber,
  cellValue,
  emptyParseLog,
  findRowContaining,
  loadWorksheetRows,
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

export async function parseHsoSheet(
  buffer: Buffer,
  sheetName?: string,
): Promise<HsoParseResult> {
  const { rows } = await loadWorksheetRows(buffer, sheetName);
  const log = emptyParseLog();
  const entries: StagedHsoEntry[] = [];

  const nameRow = findRowContaining(rows, ["name"]);
  const taskRow = findRowContaining(rows, ["tasks", "position"]);
  const dataStart = findRowContaining(rows, ["rt mentors", "tasks"]);

  if (dataStart < 0 || nameRow < 0) {
    log.errors.push("Could not find HSO sheet structure");
    return { entries, log };
  }

  const nameRowData = rows[nameRow];
  const officers: {
    col: number;
    name: string;
    sid?: string;
    room?: string;
  }[] = [];

  for (let c = 5; c < nameRowData.length; c++) {
    const name = cellValue(nameRowData[c]);
    if (name && !name.match(/^\d+\.?\d*$/) && name.length > 2) {
      const sidRow = rows[nameRow + 1] ?? [];
      const roomRow = rows[nameRow + 3] ?? [];
      officers.push({
        col: c,
        name,
        sid: cellValue(sidRow[c]),
        room: cellValue(roomRow[c]),
      });
    }
  }

  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    const task = cellValue(row[5] ?? row[4]);
    const rtMentor = cellValue(row[3] ?? row[2]);
    if (!task || task.toLowerCase() === "tasks") continue;

    for (const officer of officers) {
      const cellVal = cellValue(row[officer.col]);
      if (!cellVal) continue;

      const points = cellNumber(cellVal) || extractLeadingNumber(cellVal);

      entries.push({
        officerName: officer.name,
        officerSid: officer.sid,
        officerRoom: officer.room,
        taskLabel: task,
        rtMentor,
        points,
        notes: cellVal,
        rowIndex: r + 1,
      });
      log.matched++;
    }
  }

  return { entries, log };
}

function extractLeadingNumber(s: string): number {
  const m = s.match(/^[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
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
    const key = e.officerSid ?? e.officerName;
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

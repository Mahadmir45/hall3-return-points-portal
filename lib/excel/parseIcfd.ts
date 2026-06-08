import type { RoleCode, SessionType } from "@prisma/client";
import {
  cellNumber,
  cellValue,
  emptyParseLog,
  findColumnIndex,
  findRowContaining,
  loadWorksheetRows,
  looksLikeSid,
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

const SESSION_STOP_WORDS = [
  "subtotal",
  "final total",
  "participation points",
  "extra points",
  "award pt",
  "cheering pt",
  "problem",
  "training",
];

function parseSessionLabel(label: string): { type: SessionType; date?: Date } {
  const lower = label.toLowerCase();
  const type: SessionType = lower.includes("competition")
    ? "COMPETITION"
    : lower.includes("training")
      ? "TRAINING"
      : "OTHER";

  const slashMatch = label.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    const year = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
    return { type, date: new Date(year, parseInt(m, 10) - 1, parseInt(d, 10)) };
  }

  const isoMatch = label.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return { type, date: new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)) };
  }

  return { type, date: undefined };
}

function formatSessionHeaderLabel(val: unknown): string {
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const s = cellValue(val);
  if (!s) return "";

  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      return formatSessionHeaderLabel(parsed);
    }
  }

  return s;
}

function isTypeHeaderRow(row: unknown[]): boolean {
  return (
    cellValue(row[0]).toLowerCase() === "type" &&
    cellValue(row[1]).toLowerCase().includes("name") &&
    cellValue(row[2]).toLowerCase() === "sid"
  );
}

function isLegacySidHeaderRow(row: unknown[]): boolean {
  const text = row.map(cellValue).join(" ").toLowerCase();
  return text.includes("sid") && text.includes("name") && !isTypeHeaderRow(row);
}

function isSessionHeaderCell(label: string): boolean {
  const lower = label.toLowerCase();
  if (!label) return false;
  if (lower.includes("training") || lower.includes("competition")) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return true;
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(label)) return true;
  return false;
}

function isPointsStopColumn(label: string): boolean {
  const lower = label.toLowerCase();
  return SESSION_STOP_WORDS.some((w) => lower.includes(w));
}

function extractSessionColumns(
  header: unknown[],
  startCol: number,
): { col: number; label: string }[] {
  const cols: { col: number; label: string }[] = [];

  for (let c = startCol; c < header.length; c++) {
    const label = formatSessionHeaderLabel(header[c]);
    if (!label) continue;
    if (isPointsStopColumn(label) && !isSessionHeaderCell(label)) break;
    if (isSessionHeaderCell(label)) {
      cols.push({ col: c, label });
    }
  }

  return cols;
}

function mapIcfdRole(tag: string): RoleCode {
  const lower = tag.toLowerCase();
  if (lower.includes("coach") || lower.includes("team manager") || lower.includes("coaching")) {
    return "TEAM_MANAGER";
  }
  if (lower.includes("player")) return "PLAYER";
  if (lower === "participant") return "PLAYER";
  if (lower.includes("backup")) return "BACKUP";
  if (lower.includes("cheering")) return "CHEERING";
  if (lower.includes("unselected")) return "UNSELECTED";
  return "PLAYER";
}

function isRoleTag(val: string): boolean {
  return /manager|player|backup|cheering|unselected|coach|participant|coaching/i.test(val);
}

function readAttendance(
  row: unknown[],
  sessionCols: { col: number; label: string }[],
): Record<string, boolean> {
  const attendance: Record<string, boolean> = {};
  for (const sc of sessionCols) {
    const val = cellValue(row[sc.col]).toUpperCase();
    attendance[sc.label] = val === "Y" || val === "YES" || val === "1";
  }
  return attendance;
}

function addSession(
  sessions: StagedSession[],
  seen: Set<string>,
  label: string,
) {
  if (!label || seen.has(label)) return;
  seen.add(label);
  const { type, date } = parseSessionLabel(label);
  sessions.push({
    label,
    type,
    sessionDate: date,
    sortOrder: sessions.length,
  });
}

function parseCompactTypeFormat(rows: unknown[][]): IcfdParseResult {
  const log = emptyParseLog();
  const sessions: StagedSession[] = [];
  const participants: StagedIcfdParticipant[] = [];
  const seenSessions = new Set<string>();

  const headerRows: number[] = [];
  for (let r = 0; r < rows.length; r++) {
    if (isTypeHeaderRow(rows[r])) headerRows.push(r);
  }

  if (headerRows.length === 0) {
    return { participants, sessions, log };
  }

  for (const headerRowIdx of headerRows) {
    const header = rows[headerRowIdx] ?? [];
    const sessionCols = extractSessionColumns(header, 4);
    for (const sc of sessionCols) addSession(sessions, seenSessions, sc.label);

    const subTotalCol = findColumnIndex(header, "subtotal");
    const finalTotalCol = findColumnIndex(header, "final total");
    const nextHeader = headerRows.find((r) => r > headerRowIdx) ?? rows.length;

    for (let r = headerRowIdx + 1; r < nextHeader; r++) {
      const row = rows[r];
      if (!row) continue;

      const typeCell = cellValue(row[0]);
      const name = cellValue(row[1]);
      const sid = cellValue(row[2]);
      const room = cellValue(row[3]);

      if (!name && !sid) continue;
      if (typeCell.toLowerCase() === "type") continue;
      if (name.toLowerCase().includes("name") && sid.toLowerCase() === "sid") continue;
      if (typeCell.toLowerCase() === "total" || name.toLowerCase() === "total") continue;

      const roleCode = mapIcfdRole(typeCell || "player");
      const attendance = readAttendance(row, sessionCols);
      const basePoints = cellNumber(row[subTotalCol >= 0 ? subTotalCol : row.length - 2]);
      const computedPoints = cellNumber(
        row[finalTotalCol >= 0 ? finalTotalCol : row.length - 1],
      );
      const extraPoints = Math.max(0, computedPoints - basePoints);

      participants.push({
        rawName: name,
        rawSid: looksLikeSid(sid) ? sid : undefined,
        rawRoom: room,
        roleCode,
        basePoints,
        extraPoints,
        computedPoints: computedPoints || basePoints + extraPoints,
        rowIndex: r + 1,
        attendance,
      });
      log.matched++;
    }
  }

  return { participants, sessions, log };
}

function isSummarySectionRow(row: unknown[]): boolean {
  const text = row.map(cellValue).join(" ").toLowerCase();
  if (text.includes("summary:")) return true;
  if (
    cellValue(row[1]).toLowerCase() === "type" &&
    cellValue(row[2]).toLowerCase().includes("full name")
  ) {
    return true;
  }
  return false;
}

function parseLegacyParticipantRow(
  row: unknown[],
  r: number,
  columns: {
    roleCol: number;
    nameCol: number;
    sidCol: number;
    roomCol: number;
    sessionCols: { col: number; label: string }[];
    partPtsCol: number;
    extraPtsCol: number;
    finalCol: number;
  },
  currentRole: RoleCode,
  log: ParseLog,
): { participant: StagedIcfdParticipant | null; role: RoleCode } {
  const roleCell = cellValue(row[columns.roleCol]);
  let role = currentRole;
  if (isRoleTag(roleCell)) role = mapIcfdRole(roleCell);

  const name = cellValue(row[columns.nameCol >= 0 ? columns.nameCol : 2]);
  const sid = cellValue(row[columns.sidCol >= 0 ? columns.sidCol : 3]);
  const room = cellValue(row[columns.roomCol >= 0 ? columns.roomCol : 4]);

  if (!name && !sid) return { participant: null, role };
  if (name.toLowerCase().includes("name") && sid.toLowerCase() === "sid") {
    return { participant: null, role };
  }
  if (isRoleTag(roleCell) && !looksLikeSid(name) && !looksLikeSid(sid)) {
    return { participant: null, role };
  }
  if (!looksLikeSid(sid)) {
    if (name) log.warnings.push(`Row ${r + 1}: missing or invalid SID for ${name}`);
    return { participant: null, role };
  }

  const attendance = readAttendance(row, columns.sessionCols);
  const basePoints = cellNumber(
    row[columns.partPtsCol >= 0 ? columns.partPtsCol : row.length - 4],
  );
  const extraPoints = cellNumber(
    row[columns.extraPtsCol >= 0 ? columns.extraPtsCol : row.length - 3],
  );
  const computedPoints =
    cellNumber(row[columns.finalCol >= 0 ? columns.finalCol : row.length - 1]) ||
    basePoints + extraPoints;

  return {
    role,
    participant: {
      rawName: name,
      rawSid: sid,
      rawRoom: room,
      roleCode: isRoleTag(roleCell) ? mapIcfdRole(roleCell) : role,
      basePoints,
      extraPoints,
      computedPoints,
      rowIndex: r + 1,
      attendance,
      notes: cellValue(row[0]) ? `Row ${cellValue(row[0])}` : undefined,
    },
  };
}

function parseLegacyFormat(rows: unknown[][]): IcfdParseResult {
  const log = emptyParseLog();
  const sessions: StagedSession[] = [];
  const participants: StagedIcfdParticipant[] = [];
  const seenSessions = new Set<string>();

  const sessionBandRow = rows.findIndex((row) => {
    const text = row.map(cellValue).join(" ").toLowerCase();
    return text.includes("training") && text.includes("competition");
  });

  let dataHeaderRow = -1;
  for (let r = (sessionBandRow >= 0 ? sessionBandRow : 0); r < rows.length; r++) {
    if (isLegacySidHeaderRow(rows[r])) {
      dataHeaderRow = r;
      break;
    }
  }

  if (dataHeaderRow < 0) {
    log.errors.push("Could not find ICFD session header");
    return { participants, sessions, log };
  }

  const header = rows[dataHeaderRow] ?? [];
  log.headerRow = dataHeaderRow + 1;

  const nameCol = findColumnIndex(header, "name");
  const sidCol = findColumnIndex(header, "sid");
  const roomCol = findColumnIndex(header, "room");
  const roleCol =
    findColumnIndex(header, "male") >= 0
      ? findColumnIndex(header, "male")
      : findColumnIndex(header, "type") >= 0
        ? findColumnIndex(header, "type")
        : 1;

  const firstSessionCol = Math.max(roomCol, sidCol, nameCol) + 1;
  const sessionCols = extractSessionColumns(header, firstSessionCol);
  for (const sc of sessionCols) addSession(sessions, seenSessions, sc.label);

  const partPtsCol = findColumnIndex(header, "participation points");
  const extraPtsCol = findColumnIndex(header, "extra points");
  const finalCol = findColumnIndex(header, "final total");

  const columns = {
    roleCol,
    nameCol,
    sidCol,
    roomCol,
    sessionCols,
    partPtsCol,
    extraPtsCol,
    finalCol,
  };

  let currentRole: RoleCode = "PLAYER";

  // Team managers / coaches listed above the main SID header row
  if (sessionBandRow >= 0 && sessionBandRow < dataHeaderRow) {
    const bandHeader = rows[sessionBandRow] ?? [];
    const bandSessions = extractSessionColumns(bandHeader, 5);
    for (const sc of bandSessions) addSession(sessions, seenSessions, sc.label);

    const bandColumns = { ...columns, sessionCols: bandSessions.length ? bandSessions : sessionCols };
    for (let r = sessionBandRow + 1; r < dataHeaderRow; r++) {
      const row = rows[r];
      if (!row) continue;
      const { participant, role } = parseLegacyParticipantRow(
        row,
        r,
        bandColumns,
        currentRole,
        log,
      );
      currentRole = role;
      if (participant) {
        participants.push(participant);
        log.matched++;
      }
    }
  }

  for (let r = dataHeaderRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    if (isTypeHeaderRow(row) || isSummarySectionRow(row)) {
      break;
    }

    if (isLegacySidHeaderRow(row) && r !== dataHeaderRow) {
      const subHeader = row;
      const subNameCol = findColumnIndex(subHeader, "name");
      const subSidCol = findColumnIndex(subHeader, "sid");
      const subRoomCol = findColumnIndex(subHeader, "room");
      const subRoleCol =
        findColumnIndex(subHeader, "female") >= 0
          ? findColumnIndex(subHeader, "female")
          : findColumnIndex(subHeader, "male") >= 0
            ? findColumnIndex(subHeader, "male")
            : roleCol;
      const subFirstSessionCol = Math.max(subRoomCol, subSidCol, subNameCol) + 1;
      const subSessions = extractSessionColumns(subHeader, subFirstSessionCol);
      for (const sc of subSessions) addSession(sessions, seenSessions, sc.label);

      Object.assign(columns, {
        roleCol: subRoleCol,
        nameCol: subNameCol,
        sidCol: subSidCol,
        roomCol: subRoomCol,
        sessionCols: subSessions.length ? subSessions : sessionCols,
        partPtsCol: findColumnIndex(subHeader, "participation points"),
        extraPtsCol: findColumnIndex(subHeader, "extra points"),
        finalCol: findColumnIndex(subHeader, "final total"),
      });
      continue;
    }

    const { participant, role } = parseLegacyParticipantRow(
      row,
      r,
      columns,
      currentRole,
      log,
    );
    currentRole = role;
    if (participant) {
      participants.push(participant);
      log.matched++;
    }
  }

  return { participants, sessions, log };
}

export async function parseIcfdSheet(
  buffer: Buffer,
  sheetName?: string,
): Promise<IcfdParseResult> {
  const { rows } = await loadWorksheetRows(buffer, sheetName);

  const hasTypeHeader = rows.some(isTypeHeaderRow);
  if (hasTypeHeader) {
    const result = parseCompactTypeFormat(rows);
    if (result.participants.length > 0 || result.sessions.length > 0) {
      return result;
    }
  }

  const legacy = parseLegacyFormat(rows);
  if (legacy.participants.length === 0 && legacy.log.errors.length === 0) {
    legacy.log.errors.push("Could not find ICFD session header");
  }
  return legacy;
}

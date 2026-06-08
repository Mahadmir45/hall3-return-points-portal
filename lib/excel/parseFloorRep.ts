import {
  cellNumber,
  cellValue,
  emptyParseLog,
  findRowContaining,
  loadWorksheetRows,
  looksLikeSid,
  normalizeSid,
  type ParseLog,
} from "./helpers";
import type { StagedParticipant } from "./parseEvent";

export interface FloorRepParseResult {
  participants: StagedParticipant[];
  log: ParseLog;
}

function looksLikeFloor(val: unknown): boolean {
  const s = cellValue(val).replace(/\s/g, "");
  return /^\d+\/F$/i.test(s);
}

function looksLikeRoom(val: unknown): boolean {
  const s = cellValue(val).toUpperCase();
  return /^\d{3}[A-Z]?$/.test(s);
}

function findHeaderRow(rows: unknown[][]): number {
  const patterns: string[][] = [
    ["name of floor", "sid", "returning point"],
    ["name of floor", "sid", "rating"],
    ["floor representative", "sid", "room"],
    ["floor rep", "sid", "returning point"],
  ];
  for (const needles of patterns) {
    const row = findRowContaining(rows, needles);
    if (row >= 0) return row;
  }
  return -1;
}

function parseFloorRepRow(
  row: unknown[],
  rowIndex: number,
): StagedParticipant | null {
  let sidCol = -1;
  for (let c = 0; c < row.length; c++) {
    if (looksLikeSid(row[c])) {
      sidCol = c;
      break;
    }
  }
  if (sidCol < 0) return null;

  const sid = normalizeSid(row[sidCol]);
  if (!sid) return null;

  let name = "";
  if (sidCol >= 1) {
    const beforeSid = cellValue(row[sidCol - 1]);
    if (sidCol >= 3 && looksLikeFloor(row[0])) {
      // Floor | RT | Name | SID  OR  Floor | RT | ... | Name | SID
      name = beforeSid;
    } else if (sidCol === 2 && looksLikeFloor(row[0])) {
      // Floor | Name | SID
      name = beforeSid;
    } else if (sidCol === 1) {
      // Name | SID | Room | ...
      name = cellValue(row[0]);
    } else {
      name = beforeSid;
    }
  }

  if (
    !name ||
    looksLikeSid(name) ||
    looksLikeRoom(name) ||
    looksLikeFloor(name) ||
    name.toLowerCase().includes("floor rep")
  ) {
    return null;
  }

  const roomRaw = cellValue(row[sidCol + 1]);
  const rawRoom = looksLikeRoom(roomRaw) ? roomRaw : undefined;

  let ratingCol = sidCol + (rawRoom ? 2 : 1);
  let ptsCol = ratingCol + 1;
  let justCol = ptsCol + 1;

  // When room is missing, rating/points shift left
  if (!rawRoom && cellNumber(row[sidCol + 1]) > 0) {
    ratingCol = sidCol + 1;
    ptsCol = sidCol + 2;
    justCol = sidCol + 3;
  }

  const ratingVal = cellNumber(row[ratingCol]);
  const rating = ratingVal > 0 ? ratingVal : undefined;
  const pts = cellNumber(row[ptsCol]);
  const justification = cellValue(row[justCol]) || undefined;

  const floor = looksLikeFloor(row[0]) ? cellValue(row[0]) : undefined;
  const notes = [floor, justification].filter(Boolean).join(" — ") || undefined;

  return {
    rawName: name,
    rawSid: sid,
    rawRoom,
    roleCode: "FLOOR_REP",
    basePoints: pts,
    extraPoints: 0,
    rating,
    computedPoints: pts,
    notes,
    rowIndex,
  };
}

export async function parseFloorRepSheet(
  buffer: Buffer,
  sheetName?: string,
): Promise<FloorRepParseResult> {
  const { rows } = await loadWorksheetRows(buffer, sheetName);
  const log = emptyParseLog();
  const participants: StagedParticipant[] = [];

  const hRow = findHeaderRow(rows);
  if (hRow < 0) {
    log.errors.push("Could not find floor rep header row");
    return { participants, log };
  }
  log.headerRow = hRow + 1;

  for (let r = hRow + 1; r < rows.length; r++) {
    const row = rows[r];
    const rowText = row.map(cellValue).join(" ").toLowerCase();
    if (!rowText.trim()) continue;
    if (rowText.includes("total") && rowText.includes("return")) continue;

    const parsed = parseFloorRepRow(row, r + 1);
    if (!parsed) continue;

    participants.push(parsed);
    log.matched++;
  }

  return { participants, log };
}

import {
  cellNumber,
  cellValue,
  emptyParseLog,
  findRowContaining,
  loadWorksheetRows,
  type ParseLog,
} from "./helpers";
import type { StagedParticipant } from "./parseEvent";

export interface FloorRepParseResult {
  participants: StagedParticipant[];
  log: ParseLog;
}

export async function parseFloorRepSheet(
  buffer: Buffer,
  sheetName?: string,
): Promise<FloorRepParseResult> {
  const { rows } = await loadWorksheetRows(buffer, sheetName);
  const log = emptyParseLog();
  const participants: StagedParticipant[] = [];

  const headerRow = findRowContaining(rows, [
    "floor rep",
    "sid",
    "returning point",
  ]);
  const altHeader = findRowContaining(rows, ["name of floor", "sid", "rating"]);
  const hRow = headerRow >= 0 ? headerRow : altHeader;

  if (hRow < 0) {
    log.errors.push("Could not find floor rep header row");
    return { participants, log };
  }

  const header = rows[hRow];
  const nameCol = header.findIndex((c) =>
    cellValue(c).toLowerCase().includes("name"),
  );
  const sidCol = header.findIndex((c) =>
    cellValue(c).toLowerCase().includes("sid"),
  );
  const roomCol = header.findIndex((c) =>
    cellValue(c).toLowerCase().includes("room"),
  );
  const ratingCol = header.findIndex((c) =>
    cellValue(c).toLowerCase().includes("rating"),
  );
  const ptsCol = header.findIndex((c) =>
    cellValue(c).toLowerCase().includes("returning point"),
  );
  const justCol = header.findIndex((c) =>
    cellValue(c).toLowerCase().includes("justification"),
  );

  for (let r = hRow + 1; r < rows.length; r++) {
    const row = rows[r];
    const sid = sidCol >= 0 ? cellValue(row[sidCol]) : "";
    const name = nameCol >= 0 ? cellValue(row[nameCol]) : "";
    if (!sid && !name) continue;
    if (name.toLowerCase().includes("floor rep")) continue;

    const pts = ptsCol >= 0 ? cellNumber(row[ptsCol]) : 0;
    const rating = ratingCol >= 0 ? cellNumber(row[ratingCol]) : undefined;
    const justification =
      justCol >= 0 ? cellValue(row[justCol]) : undefined;

    participants.push({
      rawName: name,
      rawSid: sid,
      rawRoom: roomCol >= 0 ? cellValue(row[roomCol]) : undefined,
      roleCode: "FLOOR_REP",
      basePoints: pts,
      extraPoints: 0,
      rating,
      computedPoints: pts,
      notes: justification,
      rowIndex: r + 1,
    });
    log.matched++;
  }

  return { participants, log };
}

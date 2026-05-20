import type { RoleCode } from "@prisma/client";
import {
  cellNumber,
  cellValue,
  emptyParseLog,
  findColumnIndex,
  findExactColumnIndex,
  findRowContaining,
  loadWorksheetRows,
  looksLikeSid,
  normalizeSid,
  resolveBandColumns,
  type BandColumns,
  type ParseLog,
} from "./helpers";

export interface StagedParticipant {
  rawName?: string;
  rawSid?: string;
  rawRoom?: string;
  roleCode: RoleCode;
  basePoints: number;
  extraPoints: number;
  rating?: number;
  computedPoints: number;
  notes?: string;
  rowIndex: number;
}

export interface EventParseResult {
  participants: StagedParticipant[];
  eventName?: string;
  actualParticipants?: number;
  log: ParseLog;
}

function addFromBand(
  row: unknown[],
  band: BandColumns | null,
  roleCode: RoleCode,
  rowIndex: number,
  notes?: string,
): StagedParticipant | null {
  if (!band) return null;

  let name = cellValue(row[band.nameCol]);
  let sid = cellValue(row[band.sidCol]);
  const room = cellValue(row[band.roomCol]);
  const pts = band.ptsCol >= 0 ? cellNumber(row[band.ptsCol]) : 0;
  const rating =
    band.ratingCol >= 0 ? cellNumber(row[band.ratingCol]) : undefined;

  // Swap if columns were misread (name cell holds SID)
  if (looksLikeSid(name) && !looksLikeSid(sid) && sid) {
    [name, sid] = [sid, name];
  }

  if (!name && !sid) return null;

  // Skip bogus rows: pure number in name with valid SID elsewhere usually means wrong column
  if (/^\d+$/.test(name) && looksLikeSid(sid)) return null;

  if (!looksLikeSid(sid) && looksLikeSid(name)) {
    sid = name;
    name = "";
  }

  if (!name && !looksLikeSid(sid)) return null;

  const computed = pts || (roleCode === "PARTICIPANT" ? 2 : pts);

  return {
    rawName: name || undefined,
    rawSid: sid ? normalizeSid(sid) : undefined,
    rawRoom: room || undefined,
    roleCode,
    basePoints: pts || computed,
    extraPoints: 0,
    rating: rating || undefined,
    computedPoints: computed || pts,
    rowIndex,
    notes,
  };
}

export async function parseEventSheet(
  buffer: Buffer,
  sheetName?: string,
): Promise<EventParseResult> {
  const { rows } = await loadWorksheetRows(buffer, sheetName);
  const log = emptyParseLog();
  const participants: StagedParticipant[] = [];

  const headerRow = findRowContaining(rows, ["name event", "proposer"]);
  if (headerRow < 0) {
    log.errors.push("Could not find event header row");
    return { participants, log };
  }
  log.headerRow = headerRow + 1;

  const header = rows[headerRow];

  const ocNameCol = findExactColumnIndex(header, ["oc (name)", "oc(name)"]);
  const helperNameCol = findExactColumnIndex(header, ["helpers"]);
  const partNameCol = findExactColumnIndex(header, ["participants"]);

  const ocBand = resolveBandColumns(header, ocNameCol, helperNameCol);
  const helperBand = resolveBandColumns(
    header,
    helperNameCol,
    partNameCol >= 0 ? partNameCol : undefined,
  );
  const partBand = resolveBandColumns(header, partNameCol);

  const eventNameCol = findColumnIndex(header, "name event");
  const eventName = cellValue(rows[headerRow + 1]?.[eventNameCol]);
  const actualCol = findColumnIndex(header, "actual no");
  const actualParticipants =
    actualCol >= 0 ? cellNumber(rows[headerRow + 1]?.[actualCol]) : undefined;

  let currentSection = "OC";

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row?.some((c) => cellValue(c))) continue;

    const sectionCol = ocBand?.nameCol ?? 0;
    const sectionCell = cellValue(row[sectionCol > 0 ? sectionCol - 1 : 0]);
    if (sectionCell.toLowerCase().includes("performer")) {
      currentSection = "PERFORMER";
      continue;
    }

    const bands: { band: BandColumns | null; role: RoleCode; notes?: string }[] =
      [
        {
          band: ocBand,
          role: currentSection === "PERFORMER" ? "PERFORMER" : "OC",
          notes: currentSection === "PERFORMER" ? "Performer" : undefined,
        },
        { band: helperBand, role: "HELPER" },
        { band: partBand, role: "PARTICIPANT" },
      ];

    for (const { band, role, notes } of bands) {
      const p = addFromBand(row, band, role, r + 1, notes);
      if (p) {
        participants.push(p);
        log.matched++;
      }
    }
  }

  return { participants, eventName, actualParticipants, log };
}

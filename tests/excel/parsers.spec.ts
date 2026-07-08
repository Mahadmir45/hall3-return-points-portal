import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseEventSheet } from "@/lib/excel/parseEvent";
import { parseRosterSheet } from "@/lib/excel/parseRoster";
import { parseFloorRepSheet } from "@/lib/excel/parseFloorRep";
import { parseIcfdSheet } from "@/lib/excel/parseIcfd";
import { parseHsoSheet, hsoEntriesToParticipants } from "@/lib/excel/parseHso";
import { normalizeSid, cellNumber, cellValue } from "@/lib/excel/helpers";
import { computePoints } from "@/lib/scoring/rules";

const samplesDir = join(process.cwd(), "data", "samples");

function looksLikeRoomCode(val: string | undefined | null): boolean {
  return /^\d{3}[A-Z]?$/i.test(val ?? "");
}

describe("excel helpers", () => {
  it("normalizes SID from float", () => {
    expect(normalizeSid(58497196.0)).toBe("58497196");
  });

  it("parses numeric cells", () => {
    expect(cellNumber("add above")).toBe(0);
    expect(cellNumber(5)).toBe(5);
  });

  it("parses formula result objects from ExcelJS", () => {
    expect(cellNumber({ formula: "SUM(A1)", result: 7 })).toBe(7);
    expect(cellValue({ formula: "SUM(A1)", result: 4 })).toBe("4");
  });
});

describe("scoring rules", () => {
  it("computes icfd formula", () => {
    expect(
      computePoints({
        basePoints: 5,
        extraPoints: 1,
        trainingCount: 2,
        rule: { formula: "participation + extra + trainingCount" },
      }),
    ).toBe(8);
  });
});

describe("sample file parsers", () => {
  it("parses SemA roster", async () => {
    const buf = readFileSync(join(samplesDir, "0. Events_Summary25.xlsx"));
    const result = await parseRosterSheet(buf, "SemA-List");
    expect(result.rows.length).toBeGreaterThan(50);
    expect(result.rows[0].sid.length).toBeGreaterThanOrEqual(7);
  });

  it("parses welcome party event", async () => {
    const buf = readFileSync(join(samplesDir, "0. Events_Summary25.xlsx"));
    const result = await parseEventSheet(buf, "1.WelcomeParty2025");
    expect(result.participants.length).toBeGreaterThan(20);
    expect(result.eventName?.toLowerCase()).toContain("welcom");
    const parts = result.participants.filter((p) => p.roleCode === "PARTICIPANT");
    expect(parts[0]?.rawName).not.toMatch(/^\d+$/);
    expect(parts[0]?.rawSid?.length).toBeGreaterThanOrEqual(7);
  });

  it("parses trivia night reference file with correct participant names", async () => {
    const refPath = join(process.cwd(), "Data_mocked_for ref", "trivia night.xlsx");
    const buf = readFileSync(refPath);
    const result = await parseEventSheet(buf);
    const parts = result.participants.filter((p) => p.roleCode === "PARTICIPANT");
    expect(parts.length).toBeGreaterThanOrEqual(10);
    expect(parts.some((p) => p.rawName?.includes("LAU"))).toBe(true);
    expect(parts.some((p) => p.rawSid === "60175750")).toBe(true);
    expect(parts.every((p) => !/^\d+$/.test(p.rawName ?? ""))).toBe(true);
    expect(result.eventName?.toLowerCase()).toContain("trivia");
  });

  it("parses floor reps sem A", async () => {
    const buf = readFileSync(join(samplesDir, "Floor Reps25_26.xlsx"));
    const result = await parseFloorRepSheet(buf, "Floor Rep, 2526 - Sem A");
    expect(result.log.errors).toHaveLength(0);
    expect(result.participants.length).toBeGreaterThan(10);
    expect(
      result.participants.every(
        (p) =>
          p.rawSid &&
          p.rawSid.length >= 7 &&
          p.rawName &&
          !looksLikeRoomCode(p.rawName) &&
          !/^\d+$/.test(p.rawName),
      ),
    ).toBe(true);
    expect(result.participants.some((p) => p.rawSid === "58497196")).toBe(true);
  });

  it("parses floor_rep_sample with compact continuation rows", async () => {
    const refPath = join(
      process.cwd(),
      "Data_mocked_for ref",
      "floor_rep_sample.xlsx",
    );
    const buf = readFileSync(refPath);
    const result = await parseFloorRepSheet(buf);
    expect(result.log.errors).toHaveLength(0);
    expect(result.participants.length).toBeGreaterThanOrEqual(16);
    expect(
      result.participants.every(
        (p) =>
          p.rawSid &&
          p.rawSid.length >= 7 &&
          p.rawName &&
          !looksLikeRoomCode(p.rawName) &&
          !/^\d+$/.test(p.rawName),
      ),
    ).toBe(true);
    const li = result.participants.find((p) => p.rawSid === "58528050");
    expect(li?.rawName).toContain("LI Pak Yin Pazu");
    expect(li?.computedPoints).toBe(4);
    const ashar = result.participants.find((p) => p.rawSid === "57931002");
    expect(ashar?.rawName).toContain("Ashar");
    expect(ashar?.rawRoom).toBe("103A");
    expect(ashar?.computedPoints).toBe(5);
    const adnan = result.participants.find((p) => p.rawSid === "58601963");
    expect(adnan?.rawName).toContain("ADNAN");
    expect(adnan?.rawRoom).toBe("206A");
  });

  it("parses icfd_data compact sheet with formula total columns", async () => {
    const buf = readFileSync(join(samplesDir, "icfd_data.xlsx"));
    const result = await parseIcfdSheet(buf);
    expect(result.log.errors).toHaveLength(0);
    expect(result.participants.length).toBeGreaterThanOrEqual(20);
    const jalil = result.participants.find((p) => p.rawSid === "58583850");
    expect(jalil?.rawName).toContain("JALIL");
    expect(jalil?.computedPoints).toBeGreaterThan(0);
    expect(
      result.participants.filter((p) => p.computedPoints > 0).length,
    ).toBeGreaterThan(15);
  });

  it("parses test-event-upload with SID, name, and gained points per row", async () => {
    const buf = readFileSync(join(samplesDir, "test-event-upload.xlsx"));
    const result = await parseEventSheet(buf);
    expect(result.log.errors).toHaveLength(0);
    expect(result.participants.length).toBeGreaterThanOrEqual(20);
    const adnan = result.participants.find((p) => p.rawSid === "58601963");
    expect(adnan?.rawName).toContain("ADNAN");
    expect(adnan?.computedPoints).toBe(5);
    expect(
      result.participants.every(
        (p) => p.rawSid && p.rawName && p.computedPoints >= 0,
      ),
    ).toBe(true);
  });

  it("parses basketball ICFD reference file (compact TYPE layout)", async () => {
    const refPath = join(
      process.cwd(),
      "Data_mocked_for ref",
      "2.b Basketball 2526.xlsx",
    );
    const buf = readFileSync(refPath);
    const result = await parseIcfdSheet(buf);
    expect(result.log.errors).toHaveLength(0);
    expect(result.sessions.length).toBeGreaterThanOrEqual(4);
    expect(result.participants.length).toBeGreaterThanOrEqual(20);
    expect(result.participants.some((p) => p.rawSid === "58583850")).toBe(true);
    expect(result.participants.some((p) => p.roleCode === "TEAM_MANAGER")).toBe(
      true,
    );
    expect(
      result.participants.every((p) => p.rawName && !/^\d+$/.test(p.rawName)),
    ).toBe(true);
  });

  it("parses basketball ICFD legacy workbook sheet", async () => {
    const buf = readFileSync(join(samplesDir, "0.ICFD_Summary25.xlsx"));
    const result = await parseIcfdSheet(buf, "2.b Basketball 2526");
    expect(result.log.errors).toHaveLength(0);
    expect(result.participants.length).toBeGreaterThan(25);
    const michael = result.participants.find((p) =>
      p.rawName?.includes("Michael Terence Basarah"),
    );
    expect(michael?.rawSid).toBe("58786756");
    expect(michael?.roleCode).toBe("PLAYER");
  });

  it("parses hso_sample reference file with mentor names and points", async () => {
    const refPath = join(process.cwd(), "Data_mocked_for ref", "hso_sample.xlsx");
    const buf = readFileSync(refPath);
    const result = await parseHsoSheet(buf);
    const participants = hsoEntriesToParticipants(result.entries);
    expect(result.log.errors).toHaveLength(0);
    expect(participants.length).toBeGreaterThanOrEqual(10);
    const jalil = participants.find((p) => p.rawName?.includes("JALIL"));
    expect(jalil?.rawRoom).toBe("103B");
    expect(jalil?.computedPoints).toBeGreaterThan(10);
    expect(jalil?.computedPoints).toBeLessThan(100);
    expect(participants.some((p) => p.rawSid === "56676719")).toBe(true);
    expect(participants.every((p) => !p.rawName?.includes("Meeting"))).toBe(
      true,
    );
  });

  it("parses Events-SemB HSO mentor sheet", async () => {
    const buf = readFileSync(join(samplesDir, "HSO-202526-Performance.xlsx"));
    const result = await parseHsoSheet(buf, "Events-SemB");
    const participants = hsoEntriesToParticipants(result.entries);
    expect(result.log.errors).toHaveLength(0);
    expect(participants.length).toBeGreaterThanOrEqual(4);
    expect(participants.some((p) => p.rawName?.includes("JALIL"))).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseEventSheet } from "@/lib/excel/parseEvent";
import { parseRosterSheet } from "@/lib/excel/parseRoster";
import { parseFloorRepSheet } from "@/lib/excel/parseFloorRep";
import { normalizeSid, cellNumber } from "@/lib/excel/helpers";
import { computePoints } from "@/lib/scoring/rules";

const samplesDir = join(process.cwd(), "data", "samples");

describe("excel helpers", () => {
  it("normalizes SID from float", () => {
    expect(normalizeSid(58497196.0)).toBe("58497196");
  });

  it("parses numeric cells", () => {
    expect(cellNumber("add above")).toBe(0);
    expect(cellNumber(5)).toBe(5);
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
    expect(result.participants.length).toBeGreaterThan(10);
  });
});

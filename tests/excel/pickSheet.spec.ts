import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { pickWorksheet } from "@/lib/excel/pickSheet";

const samplesDir = join(process.cwd(), "data", "samples");
const refDir = join(process.cwd(), "Data_mocked_for ref");

describe("pickWorksheet", () => {
  it("picks Sem A floor rep sheet from multi-tab workbook", async () => {
    const buf = readFileSync(join(samplesDir, "Floor Reps25_26.xlsx"));
    const { sheetName } = await pickWorksheet(buf, "FLOOR_REP_SHEET", {
      semesterCode: "A",
    });
    expect(sheetName).toContain("Sem A");
  });

  it("picks Events-SemB from HSO workbook", async () => {
    const buf = readFileSync(join(samplesDir, "HSO-202526-Performance.xlsx"));
    const { sheetName } = await pickWorksheet(buf, "HSO_SHEET", {
      semesterCode: "B",
    });
    expect(sheetName.toLowerCase()).toContain("events");
    expect(sheetName.toLowerCase()).toContain("semb");
  });

  it("picks basketball sheet from ICFD summary", async () => {
    const buf = readFileSync(join(samplesDir, "0.ICFD_Summary25.xlsx"));
    const { sheetName } = await pickWorksheet(buf, "ICFD_REPORT", {
      activityName: "Basketball 2526",
    });
    expect(sheetName.toLowerCase()).toContain("basketball");
  });

  it("picks welcome party from events summary", async () => {
    const buf = readFileSync(join(samplesDir, "0. Events_Summary25.xlsx"));
    const { sheetName } = await pickWorksheet(buf, "RLA_REPORT", {
      activityName: "Welcome Party 2025",
    });
    expect(sheetName.toLowerCase()).toContain("welcome");
  });

  it("uses preferred sheet when provided", async () => {
    const buf = readFileSync(join(refDir, "floor_rep_sample.xlsx"));
    const { sheetName } = await pickWorksheet(buf, "FLOOR_REP_SHEET", {
      preferredSheet: "Sheet1",
    });
    expect(sheetName).toBe("Sheet1");
  });
});

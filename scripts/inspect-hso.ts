import { readFileSync } from "fs";
import { loadWorksheetRows, cellValue } from "../lib/excel/helpers";
import { parseHsoSheet, hsoEntriesToParticipants } from "../lib/excel/parseHso";

async function main() {
  const path = process.argv[2] ?? "Data_mocked_for ref/hso_sample.xlsx";
  const buf = readFileSync(path);
  const { rows, usedSheet, sheetNames } = await loadWorksheetRows(buf);
  console.log("Sheets:", sheetNames);
  console.log("Used:", usedSheet);
  console.log("Total rows:", rows.length);

  for (let r = 0; r < Math.min(rows.length, 60); r++) {
    const row = rows[r];
    const cells = row
      .map((c, i) => {
        const v = cellValue(c);
        return v ? `[${i}]="${v.slice(0, 45)}"` : null;
      })
      .filter(Boolean);
    if (cells.length) console.log(`Row ${r + 1}:`, cells.join(" "));
  }

  const result = await parseHsoSheet(buf);
  console.log("\nParse errors:", result.log.errors);
  console.log("Entries:", result.entries.length);
  console.log("First 5 entries:", result.entries.slice(0, 5));
  const parts = hsoEntriesToParticipants(result.entries);
  console.log("Participants:", parts.length);
  console.log("First 5 participants:", parts.slice(0, 5));
}

main();

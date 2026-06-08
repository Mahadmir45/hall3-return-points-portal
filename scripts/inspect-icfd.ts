import { readFileSync } from "fs";
import { loadWorksheetRows, cellValue } from "../lib/excel/helpers";
import { parseIcfdSheet } from "../lib/excel/parseIcfd";

async function main() {
  const path = process.argv[2] ?? "Data_mocked_for ref/2.b Basketball 2526.xlsx";
  const buf = readFileSync(path);
  const { rows, usedSheet, sheetNames } = await loadWorksheetRows(buf);
  console.log("Sheets:", sheetNames);
  console.log("Used:", usedSheet);
  console.log("Total rows:", rows.length);

  for (let r = 0; r < Math.min(rows.length, 55); r++) {
    const row = rows[r];
    const cells = row
      .map((c, i) => {
        const v = cellValue(c);
        return v ? `[${i}]="${v.slice(0, 50)}"` : null;
      })
      .filter(Boolean);
    if (cells.length) console.log(`Row ${r + 1}:`, cells.join(" "));
  }

  const result = await parseIcfdSheet(buf);
  console.log("\nParse errors:", result.log.errors);
  console.log("Sessions:", result.sessions.length, result.sessions.map((s) => s.label));
  console.log("Participants:", result.participants.length);
  if (result.participants[0]) console.log("First:", result.participants[0]);
}

main();

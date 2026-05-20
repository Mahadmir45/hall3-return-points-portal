/**
 * Generates data/samples/test-event-upload.xlsx in Welcome Party RLA format.
 * Run after bootstrap/seed so roster SIDs resolve cleanly.
 */
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { join } from "path";

const prisma = new PrismaClient();

async function main() {
  const hall = await prisma.hall.findUnique({ where: { slug: "hall-3" } });
  if (!hall) throw new Error("Hall 3 not found — run pnpm db:seed first");

  const year = await prisma.academicYear.findFirst({
    where: { hallId: hall.id, label: "2025/26" },
    include: { semesters: { where: { code: "A" } } },
  });
  const semester = year?.semesters[0];
  if (!semester) throw new Error("Semester A not found");

  const enrollments = await prisma.enrollment.findMany({
    where: { semesterId: semester.id },
    include: { student: true },
    take: 30,
    orderBy: { student: { nameFull: "asc" } },
  });

  if (enrollments.length < 20) {
    throw new Error("Not enough roster rows — run pnpm bootstrap first");
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Test Upload Event");

  const preamble = [
    "Reminder:",
    "*** RTs should complete this form after each event ***",
    "*** This spreadsheet is for Hall 3 return points ***",
    "1. Each proposer/OC fills in participant details",
    "2. After the activity, upload photos to the folder",
    "3. RTs input gained points per role",
    "4. RTs please input performance rating where applicable",
    "Note: RT can give reduced points for poor performance",
    "Note: HMT will discuss borderline cases",
    "Score system: X = 8 max for OC",
    "Performance rate: Excellent / Good / Normal",
  ];

  for (let i = 0; i < 12; i++) {
    ws.getCell(i + 1, 2).value = preamble[i] ?? "";
  }

  const headerRow = 13;
  const headers = [
    "",
    "Name event",
    "Proposer (/w room no)",
    "Tentative date",
    "Time",
    "Description",
    "Tentative no. of participants",
    "Budget",
    "After the event",
    "IG Caption (Pre-Event)",
    "IG Caption (Post-Event)",
    "Actual no. of participants",
    "OC (Name)",
    "SID",
    "Room No.",
    "Gained Pts",
    "Helpers",
    "SID",
    "Room No.",
    "Gained Pts",
    "Rating",
    "Participants",
    "",
    "",
    "Gained Pts",
    "Rating",
  ];
  headers.forEach((h, c) => {
    ws.getCell(headerRow, c + 1).value = h;
  });

  ws.getCell(headerRow + 1, 2).value = "Test Upload Event (Mock)";
  ws.getCell(headerRow + 1, 4).value = "May 20, 2026";
  ws.getCell(headerRow + 1, 12).value = 25;

  const ocRows = enrollments.slice(0, 5);
  const helperRows = enrollments.slice(5, 10);
  const participantRows = enrollments.slice(10, 25);

  let row = headerRow + 1;
  for (let i = 0; i < ocRows.length; i++) {
    const e = ocRows[i];
    ws.getCell(row + i, 13).value = e.student.nameFull;
    ws.getCell(row + i, 14).value = e.student.sid;
    ws.getCell(row + i, 15).value = e.roomCode.replace("SR03-", "");
    ws.getCell(row + i, 16).value = 5 + (i % 2);
  }

  for (let i = 0; i < helperRows.length; i++) {
    const e = helperRows[i];
    ws.getCell(row + i, 17).value = e.student.nameFull;
    ws.getCell(row + i, 18).value = e.student.sid;
    ws.getCell(row + i, 19).value = e.roomCode.replace("SR03-", "");
    ws.getCell(row + i, 20).value = 3;
  }

  for (let i = 0; i < participantRows.length; i++) {
    const e = participantRows[i];
    ws.getCell(row + i, 22).value = e.student.nameFull;
    ws.getCell(row + i, 23).value = e.student.sid;
    ws.getCell(row + i, 24).value = e.roomCode.replace("SR03-", "");
    ws.getCell(row + i, 25).value = 2;
    ws.getCell(row + i, 26).value = 2;
  }

  const outPath = join(process.cwd(), "data", "samples", "test-event-upload.xlsx");
  await wb.xlsx.writeFile(outPath);

  console.log(`Wrote ${outPath}`);
  console.log(`  OC: ${ocRows.length}, Helpers: ${helperRows.length}, Participants: ${participantRows.length}`);
  console.log("  All SIDs from Sem A roster — expect PARSED with 0 unresolved on apply.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

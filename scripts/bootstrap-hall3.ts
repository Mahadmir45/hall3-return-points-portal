/**
 * One-shot bootstrap: imports Hall 3 sample Excel files into the database.
 * Run: pnpm bootstrap
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { ensureCategoriesForSemester } from "../lib/db";
import { parseRosterSheet } from "../lib/excel/parseRoster";
import { parseEventSheet } from "../lib/excel/parseEvent";
import { parseIcfdSheet } from "../lib/excel/parseIcfd";
import { parseFloorRepSheet } from "../lib/excel/parseFloorRep";
import {
  parseHsoSheet,
  hsoEntriesToParticipants,
} from "../lib/excel/parseHso";
import { matchStudentBySid } from "../lib/excel/helpers";
import ExcelJS from "exceljs";

const prisma = new PrismaClient();
const samplesDir = join(process.cwd(), "data", "samples");

async function main() {
  const report: {
    unmatchedSids: string[];
    eventsCreated: number;
    sportsCreated: number;
    warnings: string[];
  } = {
    unmatchedSids: [],
    eventsCreated: 0,
    sportsCreated: 0,
    warnings: [],
  };

  const hall = await prisma.hall.upsert({
    where: { slug: "hall-3" },
    create: {
      code: "H3",
      slug: "hall-3",
      name: "Hall 3",
      address: "Shaw College, CUHK",
    },
    update: {},
  });

  const year = await prisma.academicYear.upsert({
    where: { hallId_label: { hallId: hall.id, label: "2025/26" } },
    create: {
      hallId: hall.id,
      label: "2025/26",
      startDate: new Date("2025-08-01"),
      endDate: new Date("2026-07-31"),
    },
    update: {},
  });

  const semA = await prisma.semester.upsert({
    where: { academicYearId_code: { academicYearId: year.id, code: "A" } },
    create: { academicYearId: year.id, code: "A", label: "Semester A" },
    update: {},
  });
  const semB = await prisma.semester.upsert({
    where: { academicYearId_code: { academicYearId: year.id, code: "B" } },
    create: { academicYearId: year.id, code: "B", label: "Semester B" },
    update: {},
  });

  for (const sem of [semA, semB]) {
    await ensureCategoriesForSemester(sem.id);
  }

  const eventsBuffer = readFileSync(
    join(samplesDir, "0. Events_Summary25.xlsx"),
  );

  for (const [sem, sheetName] of [
    [semA, "SemA-List"],
    [semB, "SemB-List"],
  ] as const) {
    const roster = await parseRosterSheet(eventsBuffer, sheetName);
    for (const row of roster.rows) {
      const student = await prisma.student.upsert({
        where: { hallId_sid: { hallId: hall.id, sid: row.sid } },
        create: {
          hallId: hall.id,
          sid: row.sid,
          nameFull: row.nameFull,
          gender: row.gender,
          programYear: row.programYear,
          program: row.program,
          country: row.country,
        },
        update: {
          nameFull: row.nameFull,
          gender: row.gender,
          programYear: row.programYear,
          program: row.program,
          country: row.country,
        },
      });
      await prisma.enrollment.upsert({
        where: {
          studentId_semesterId: { studentId: student.id, semesterId: sem.id },
        },
        create: {
          studentId: student.id,
          semesterId: sem.id,
          roomCode: row.roomCode,
          bedNo: row.bedNo,
          checkIn: row.checkIn,
          checkOut: row.checkOut,
          status: row.status,
        },
        update: {
          roomCode: row.roomCode,
          bedNo: row.bedNo,
          checkIn: row.checkIn,
          checkOut: row.checkOut,
          status: row.status,
        },
      });
    }
  }

  const students = await prisma.student.findMany({
    where: { hallId: hall.id },
    select: { id: true, sid: true },
  });

  const eventsCategoryA = await prisma.category.findUniqueOrThrow({
    where: { semesterId_code: { semesterId: semA.id, code: "EVENTS" } },
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(eventsBuffer as never);
  for (const ws of wb.worksheets) {
    if (
      ws.name.startsWith("0.") ||
      ws.name.includes("List") ||
      ws.name.includes("Template")
    ) {
      continue;
    }
    const sheetBuf = eventsBuffer;
    const parsed = await parseEventSheet(sheetBuf, ws.name);
    if (parsed.participants.length === 0) continue;

    const activity = await prisma.activity.create({
      data: {
        categoryId: eventsCategoryA.id,
        type: "EVENT",
        name: parsed.eventName ?? ws.name,
        externalCode: ws.name,
        sortKey: ws.name.match(/^(\d+)/)?.[1]?.padStart(2, "0") ?? "00",
        status: "ACTIVE",
      },
    });
    report.eventsCreated++;

    for (const p of parsed.participants) {
      const studentId = matchStudentBySid(p.rawSid ?? "", students);
      if (!studentId && p.rawSid) report.unmatchedSids.push(p.rawSid);
      await prisma.activityParticipant.create({
        data: {
          activityId: activity.id,
          studentId,
          rawName: p.rawName,
          rawSid: p.rawSid,
          rawRoom: p.rawRoom,
          roleCode: p.roleCode,
          basePoints: p.basePoints,
          extraPoints: p.extraPoints,
          rating: p.rating,
          computedPoints: p.computedPoints,
          isResolved: !!studentId,
          notes: p.notes,
        },
      });
    }
  }

  const icfdBuffer = readFileSync(join(samplesDir, "0.ICFD_Summary25.xlsx"));
  const icfdCategoryA = await prisma.category.findUniqueOrThrow({
    where: { semesterId_code: { semesterId: semA.id, code: "ICFD" } },
  });

  const icfdWb = new ExcelJS.Workbook();
  await icfdWb.xlsx.load(icfdBuffer as never);
  for (const ws of icfdWb.worksheets) {
    if (
      ws.name.startsWith("0.") ||
      ws.name.toLowerCase().includes("template") ||
      ws.name === "HallT" ||
      ws.name === "Remarks"
    ) {
      continue;
    }
    const parsed = await parseIcfdSheet(icfdBuffer, ws.name);
    if (parsed.participants.length === 0) continue;

    const activity = await prisma.activity.create({
      data: {
        categoryId: icfdCategoryA.id,
        type: "SPORT",
        name: ws.name.replace(/^\d+\.?\s*[a-z]?\s*/, ""),
        externalCode: ws.name,
        status: "ACTIVE",
      },
    });
    report.sportsCreated++;

    const sessionMap = new Map<string, string>();
    for (const s of parsed.sessions) {
      const sess = await prisma.activitySession.create({
        data: {
          activityId: activity.id,
          label: s.label,
          type: s.type,
          sessionDate: s.sessionDate,
          sortOrder: s.sortOrder,
        },
      });
      sessionMap.set(s.label, sess.id);
    }

    for (const p of parsed.participants) {
      const studentId = matchStudentBySid(p.rawSid ?? "", students);
      if (!studentId && p.rawSid) report.unmatchedSids.push(p.rawSid);
      const participant = await prisma.activityParticipant.create({
        data: {
          activityId: activity.id,
          studentId,
          rawName: p.rawName,
          rawSid: p.rawSid,
          rawRoom: p.rawRoom,
          roleCode: p.roleCode,
          basePoints: p.basePoints,
          extraPoints: p.extraPoints,
          computedPoints: p.computedPoints,
          isResolved: !!studentId,
        },
      });
      for (const [label, attended] of Object.entries(p.attendance)) {
        const sessionId = sessionMap.get(label);
        if (sessionId) {
          await prisma.attendance.create({
            data: { sessionId, participantId: participant.id, attended },
          });
        }
      }
    }
  }

  const floorRepBuffer = readFileSync(
    join(samplesDir, "Floor Reps25_26.xlsx"),
  );
  for (const [sem, sheetName] of [
    [semA, "Floor Rep, 2526 - Sem A"],
    [semB, "Floor Rep, 2526 - Sem B"],
  ] as const) {
    const cat = await prisma.category.findUniqueOrThrow({
      where: { semesterId_code: { semesterId: sem.id, code: "FLOOR_REPS" } },
    });
    const activity = await prisma.activity.upsert({
      where: { id: `floor-rep-${sem.id}` },
      create: {
        id: `floor-rep-${sem.id}`,
        categoryId: cat.id,
        type: "FLOOR_REP_TERM",
        name: `Floor Reps ${sem.code}`,
        status: "ACTIVE",
      },
      update: {},
    });

    const parsed = await parseFloorRepSheet(floorRepBuffer, sheetName);
    for (const p of parsed.participants) {
      const studentId = matchStudentBySid(p.rawSid ?? "", students);
      await prisma.activityParticipant.create({
        data: {
          activityId: activity.id,
          studentId,
          rawName: p.rawName,
          rawSid: p.rawSid,
          rawRoom: p.rawRoom,
          roleCode: "FLOOR_REP",
          basePoints: p.basePoints,
          computedPoints: p.computedPoints,
          isResolved: !!studentId,
          notes: p.notes,
        },
      });
    }
  }

  const hsoBuffer = readFileSync(
    join(samplesDir, "HSO-202526-Performance.xlsx"),
  );
  for (const [sem, sheetName] of [
    [semA, "Events-SemA"],
    [semB, "Events-SemB"],
  ] as const) {
    const cat = await prisma.category.findUniqueOrThrow({
      where: { semesterId_code: { semesterId: sem.id, code: "HSO" } },
    });
    const activity = await prisma.activity.create({
      data: {
        categoryId: cat.id,
        type: "HSO_TERM",
        name: `HSO Performance Sem ${sem.code}`,
        status: "ACTIVE",
      },
    });
    const parsed = await parseHsoSheet(hsoBuffer, sheetName);
    const participants = hsoEntriesToParticipants(parsed.entries);
    for (const p of participants) {
      const studentId = matchStudentBySid(p.rawSid ?? "", students);
      await prisma.activityParticipant.create({
        data: {
          activityId: activity.id,
          studentId,
          rawName: p.rawName,
          rawSid: p.rawSid,
          rawRoom: p.rawRoom,
          roleCode: "OFFICER",
          basePoints: p.basePoints,
          computedPoints: p.computedPoints,
          isResolved: !!studentId,
          notes: p.notes,
        },
      });
    }
  }

  report.unmatchedSids = [...new Set(report.unmatchedSids)];
  const reportPath = join(process.cwd(), "bootstrap-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("Bootstrap complete:", report);
  console.log("Report written to", reportPath);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

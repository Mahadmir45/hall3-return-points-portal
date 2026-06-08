import { prisma } from "@/lib/db";
import { getObjectBuffer } from "@/lib/storage";
import { parseEventSheet } from "@/lib/excel/parseEvent";
import { parseIcfdSheet } from "@/lib/excel/parseIcfd";
import { parseFloorRepSheet } from "@/lib/excel/parseFloorRep";
import {
  parseHsoSheet,
  hsoEntriesToParticipants,
} from "@/lib/excel/parseHso";
import { parseRosterSheet } from "@/lib/excel/parseRoster";
import { pickWorksheet } from "@/lib/excel/pickSheet";
import { matchStudentBySid } from "@/lib/excel/helpers";
import type { ParseLog } from "@/lib/excel/helpers";
import {
  computeParticipantPointsFromRules,
} from "@/lib/scoring/recomputeParticipantPoints";
import type { Prisma } from "@prisma/client";

async function resolveSheetName(
  upload: {
    id: string;
    kind: import("@prisma/client").UploadKind;
    originalFilename: string;
    sheetName: string | null;
    activity: {
      name: string;
      category: { semester: { code: string } };
    } | null;
    semester: { code: string } | null;
  },
  buffer: Buffer,
): Promise<string> {
  const pick = await pickWorksheet(buffer, upload.kind, {
    activityName: upload.activity?.name,
    semesterCode:
      upload.semester?.code ??
      upload.activity?.category?.semester?.code ??
      null,
    filename: upload.originalFilename,
    preferredSheet: upload.sheetName ?? undefined,
  });

  if (!upload.sheetName || upload.sheetName !== pick.sheetName) {
    await prisma.upload.update({
      where: { id: upload.id },
      data: { sheetName: pick.sheetName },
    });
  }

  return pick.sheetName;
}

export async function processUpload(uploadId: string) {
  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
    include: {
      activity: { include: { category: { include: { semester: true } } } },
      semester: true,
    },
  });

  if (!upload) throw new Error(`Upload ${uploadId} not found`);

  await prisma.upload.update({
    where: { id: uploadId },
    data: { parseStatus: "PENDING" },
  });

  try {
    const buffer = await getObjectBuffer(upload.storageKey);
    const sheetName = await resolveSheetName(upload, buffer);

    let log: ParseLog = {
      matched: 0,
      unresolved: [],
      warnings: [],
      errors: [],
    };

    await prisma.participantStaging.deleteMany({ where: { uploadId } });
    await prisma.sessionStaging.deleteMany({ where: { uploadId } });

    const stagingRows: Prisma.ParticipantStagingCreateManyInput[] = [];
    const sessionRows: Prisma.SessionStagingCreateManyInput[] = [];

    switch (upload.kind) {
      case "RLA_REPORT": {
        const result = await parseEventSheet(buffer, sheetName);
        log = result.log;
        for (const p of result.participants) {
          stagingRows.push({
            uploadId,
            activityId: upload.activityId ?? undefined,
            rawName: p.rawName,
            rawSid: p.rawSid,
            rawRoom: p.rawRoom,
            roleCode: p.roleCode,
            basePoints: p.basePoints,
            extraPoints: p.extraPoints,
            rating: p.rating,
            computedPoints: p.computedPoints,
            notes: p.notes,
            rowIndex: p.rowIndex,
          });
        }
        break;
      }
      case "ICFD_REPORT": {
        const result = await parseIcfdSheet(buffer, sheetName);
        log = result.log;
        for (const s of result.sessions) {
          sessionRows.push({
            uploadId,
            label: s.label,
            type: s.type,
            sessionDate: s.sessionDate,
            sortOrder: s.sortOrder,
          });
        }
        for (const p of result.participants) {
          stagingRows.push({
            uploadId,
            activityId: upload.activityId ?? undefined,
            rawName: p.rawName,
            rawSid: p.rawSid,
            rawRoom: p.rawRoom,
            roleCode: p.roleCode,
            basePoints: p.basePoints,
            extraPoints: p.extraPoints,
            computedPoints: p.computedPoints,
            notes: p.notes,
            rowIndex: p.rowIndex,
            sessionData: p.attendance as Prisma.InputJsonValue,
          });
        }
        break;
      }
      case "FLOOR_REP_SHEET": {
        const result = await parseFloorRepSheet(buffer, sheetName);
        log = result.log;
        for (const p of result.participants) {
          stagingRows.push({
            uploadId,
            activityId: upload.activityId ?? undefined,
            rawName: p.rawName,
            rawSid: p.rawSid,
            rawRoom: p.rawRoom,
            roleCode: p.roleCode,
            basePoints: p.basePoints,
            extraPoints: p.extraPoints,
            rating: p.rating,
            computedPoints: p.computedPoints,
            notes: p.notes,
            rowIndex: p.rowIndex,
          });
        }
        break;
      }
      case "HSO_SHEET": {
        const result = await parseHsoSheet(buffer, sheetName);
        log = result.log;
        const participants = hsoEntriesToParticipants(result.entries);
        for (const p of participants) {
          stagingRows.push({
            uploadId,
            activityId: upload.activityId ?? undefined,
            rawName: p.rawName,
            rawSid: p.rawSid,
            rawRoom: p.rawRoom,
            roleCode: p.roleCode,
            basePoints: p.basePoints,
            computedPoints: p.computedPoints,
            notes: p.notes,
            rowIndex: p.rowIndex,
            sessionData: p.sessionData as Prisma.InputJsonValue,
          });
        }
        break;
      }
      case "ROSTER": {
        const result = await parseRosterSheet(buffer, sheetName);
        log = result.log;
        if (!upload.semesterId) {
          log.errors.push("Roster upload requires semesterId");
          break;
        }
        for (const row of result.rows) {
          const student = await prisma.student.upsert({
            where: {
              hallId_sid: { hallId: upload.hallId, sid: row.sid },
            },
            create: {
              hallId: upload.hallId,
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
              studentId_semesterId: {
                studentId: student.id,
                semesterId: upload.semesterId,
              },
            },
            create: {
              studentId: student.id,
              semesterId: upload.semesterId,
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
        break;
      }
      default:
        log.errors.push(`Unsupported upload kind: ${upload.kind}`);
    }

    if (stagingRows.length > 0) {
      await prisma.participantStaging.createMany({ data: stagingRows });
    }
    if (sessionRows.length > 0) {
      await prisma.sessionStaging.createMany({ data: sessionRows });
    }

    log.warnings.push(`Parsed worksheet: ${sheetName}`);

    const status =
      log.errors.length > 0
        ? "FAILED"
        : log.unresolved.length > 0
          ? "PARTIAL"
          : "PARSED";

    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        parseStatus: status,
        parseLogJson: log as unknown as Prisma.InputJsonValue,
        parsedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        parseStatus: "FAILED",
        parseLogJson: {
          matched: 0,
          unresolved: [],
          warnings: [],
          errors: [err instanceof Error ? err.message : String(err)],
        },
        parsedAt: new Date(),
      },
    });
    throw err;
  }
}

export async function applyUpload(uploadId: string, userId: string) {
  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
    include: {
      activity: { include: { category: true } },
    },
  });
  if (!upload?.activityId || !upload.activity) {
    throw new Error("Upload must be linked to an activity");
  }

  const staging = await prisma.participantStaging.findMany({
    where: { uploadId, isApplied: false },
  });

  const [students, rules] = await Promise.all([
    prisma.student.findMany({
      where: { hallId: upload.hallId },
      select: { id: true, sid: true },
    }),
    prisma.scoringRule.findMany({ where: { hallId: upload.hallId } }),
  ]);

  const sessions = await prisma.sessionStaging.findMany({
    where: { uploadId },
    orderBy: { sortOrder: "asc" },
  });

  const sessionMap = new Map<string, string>();
  for (const s of sessions) {
    const existing = await prisma.activitySession.findFirst({
      where: { activityId: upload.activityId, label: s.label },
    });
    const created =
      existing ??
      (await prisma.activitySession.create({
        data: {
          activityId: upload.activityId,
          label: s.label,
          type: s.type,
          sessionDate: s.sessionDate,
          sortOrder: s.sortOrder,
        },
      }));
    sessionMap.set(s.label, created.id);
  }

  let duplicatesUpdated = 0;
  let created = 0;

  for (const row of staging) {
    const studentId = matchStudentBySid(row.rawSid ?? "", students);

    const orConditions: {
      studentId?: string;
      rawSid?: string;
      roleCode: typeof row.roleCode;
    }[] = [];
    if (studentId) {
      orConditions.push({ studentId, roleCode: row.roleCode });
    }
    if (row.rawSid) {
      orConditions.push({ rawSid: row.rawSid, roleCode: row.roleCode });
    }

    const dupe =
      orConditions.length > 0
        ? await prisma.activityParticipant.findFirst({
            where: {
              activityId: upload.activityId,
              OR: orConditions,
            },
          })
        : null;

    let participantId: string;
    const resolvedStudentId = studentId ?? dupe?.studentId ?? null;

    if (dupe) {
      await prisma.activityParticipant.update({
        where: { id: dupe.id },
        data: {
          studentId: resolvedStudentId,
          rawName: row.rawName ?? dupe.rawName,
          rawSid: row.rawSid ?? dupe.rawSid,
          rawRoom: row.rawRoom ?? dupe.rawRoom,
          basePoints: row.basePoints,
          extraPoints: row.extraPoints,
          rating: row.rating,
          isResolved: !!resolvedStudentId,
          notes: row.notes,
        },
      });
      participantId = dupe.id;
      duplicatesUpdated++;
    } else {
      const participant = await prisma.activityParticipant.create({
        data: {
          activityId: upload.activityId,
          studentId: resolvedStudentId,
          rawName: row.rawName,
          rawSid: row.rawSid,
          rawRoom: row.rawRoom,
          roleCode: row.roleCode,
          basePoints: row.basePoints,
          extraPoints: row.extraPoints,
          rating: row.rating,
          computedPoints: 0,
          isResolved: !!resolvedStudentId,
          notes: row.notes,
        },
      });
      participantId = participant.id;
      created++;
    }

    const sessionData = row.sessionData as Record<string, boolean> | null;
    if (sessionData) {
      for (const [label, attended] of Object.entries(sessionData)) {
        const sessionId = sessionMap.get(label);
        if (sessionId) {
          await prisma.attendance.upsert({
            where: {
              sessionId_participantId: {
                sessionId,
                participantId,
              },
            },
            create: {
              sessionId,
              participantId,
              attended,
            },
            update: { attended },
          });
        }
      }
    }

    const attendance = await prisma.attendance.findMany({
      where: { participantId },
    });
    const computedPoints = computeParticipantPointsFromRules({
      activityType: upload.activity.type,
      categoryId: upload.activity.categoryId,
      basePoints: row.basePoints,
      extraPoints: row.extraPoints,
      rating: row.rating,
      attendance,
      rules,
    });

    await prisma.activityParticipant.update({
      where: { id: participantId },
      data: { computedPoints },
    });

    await prisma.participantStaging.update({
      where: { id: row.id },
      data: { isApplied: true, participantId, computedPoints },
    });
  }

  const existingLog =
    (upload.parseLogJson as Record<string, unknown> | null) ?? {};
  await prisma.upload.update({
    where: { id: uploadId },
    data: {
      parseLogJson: {
        ...existingLog,
        applySummary: { created, duplicatesUpdated },
      } as unknown as Prisma.InputJsonValue,
    },
  });

  await logAuditSafe(upload.hallId, userId, "APPLY_UPLOAD", "Upload", uploadId);
}

async function logAuditSafe(
  hallId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
) {
  const { logAudit } = await import("@/lib/audit");
  await logAudit({ hallId, userId, action, entityType, entityId });
}

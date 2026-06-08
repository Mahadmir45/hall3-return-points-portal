import { prisma } from "@/lib/db";
import { normalizeSid } from "@/lib/excel/helpers";
import type { CategoryCode } from "@prisma/client";

export interface StudentPointTotal {
  studentId: string;
  sid: string;
  nameFull: string;
  roomCode: string;
  byCategory: Record<string, number>;
  grandTotal: number;
}

export interface TabulationResult {
  totals: StudentPointTotal[];
  categories: { id: string; code: CategoryCode; name: string }[];
  meta: {
    activityCount: number;
    activitiesWithPoints: number;
    participantRowCount: number;
  };
}

export async function tabulateSemesterPoints(
  hallId: string,
  semesterId: string,
): Promise<TabulationResult> {
  const [enrollments, categories, students] = await Promise.all([
    prisma.enrollment.findMany({
      where: { semesterId },
      include: { student: true },
      orderBy: { student: { nameFull: "asc" } },
    }),
    prisma.category.findMany({
      where: { semesterId },
      select: { id: true, code: true, name: true },
    }),
    prisma.student.findMany({
      where: { hallId },
      select: { id: true, sid: true },
    }),
  ]);

  const sidToStudentId = new Map<string, string>();
  for (const s of students) {
    sidToStudentId.set(normalizeSid(s.sid), s.id);
  }

  const categoryIds = categories.map((c) => c.id);
  const activities = await prisma.activity.findMany({
    where: { categoryId: { in: categoryIds } },
    select: { id: true, categoryId: true },
  });

  const activityToCategory = new Map(
    activities.map((a) => [a.id, a.categoryId]),
  );
  const categoryCodeById = new Map(categories.map((c) => [c.id, c.code]));

  const participants = await prisma.activityParticipant.findMany({
    where: { activityId: { in: activities.map((a) => a.id) } },
    select: {
      activityId: true,
      studentId: true,
      rawSid: true,
      computedPoints: true,
    },
  });

  const pointsByStudentCategory = new Map<string, Map<string, number>>();
  const activitiesWithPoints = new Set<string>();

  for (const p of participants) {
    const studentId =
      p.studentId ??
      (p.rawSid ? sidToStudentId.get(normalizeSid(p.rawSid)) ?? null : null);
    if (!studentId) continue;

    const catId = activityToCategory.get(p.activityId);
    if (!catId) continue;
    const catCode = categoryCodeById.get(catId);
    if (!catCode) continue;

    activitiesWithPoints.add(p.activityId);

    if (!pointsByStudentCategory.has(studentId)) {
      pointsByStudentCategory.set(studentId, new Map());
    }
    const catMap = pointsByStudentCategory.get(studentId)!;
    catMap.set(catCode, (catMap.get(catCode) ?? 0) + p.computedPoints);
  }

  const totals: StudentPointTotal[] = enrollments.map((e) => {
    const catMap = pointsByStudentCategory.get(e.student.id) ?? new Map();
    const byCategory: Record<string, number> = {};
    let grandTotal = 0;

    for (const cat of categories) {
      const sum = catMap.get(cat.code) ?? 0;
      byCategory[cat.code] = sum;
      grandTotal += sum;
    }

    return {
      studentId: e.student.id,
      sid: e.student.sid,
      nameFull: e.student.nameFull,
      roomCode: e.roomCode,
      byCategory,
      grandTotal,
    };
  });

  return {
    totals,
    categories,
    meta: {
      activityCount: activities.length,
      activitiesWithPoints: activitiesWithPoints.size,
      participantRowCount: participants.length,
    },
  };
}

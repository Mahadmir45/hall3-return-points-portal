import { prisma } from "@/lib/db";
import { deleteLocalStorageFile } from "@/lib/admin/storageFiles";

export async function clearHallData(hallId: string) {
  const years = await prisma.academicYear.findMany({
    where: { hallId },
    select: { id: true },
  });
  const semesterIds = (
    await prisma.semester.findMany({
      where: { academicYearId: { in: years.map((y) => y.id) } },
      select: { id: true },
    })
  ).map((s) => s.id);

  const categoryIds = (
    await prisma.category.findMany({
      where: { semesterId: { in: semesterIds } },
      select: { id: true },
    })
  ).map((c) => c.id);

  const storageKeys = [
    ...(await prisma.upload.findMany({
      where: { hallId },
      select: { storageKey: true },
    })),
    ...(await prisma.asset.findMany({
      where: { activity: { categoryId: { in: categoryIds } } },
      select: { storageKey: true },
    })),
  ].map((r) => r.storageKey);

  const summary = await prisma.$transaction(async (tx) => {
    const auditLogs = await tx.auditLog.deleteMany({ where: { hallId } });
    const uploads = await tx.upload.deleteMany({ where: { hallId } });
    const snapshots = await tx.semesterSnapshot.deleteMany({
      where: { semesterId: { in: semesterIds } },
    });
    const enrollments = await tx.enrollment.deleteMany({
      where: { semesterId: { in: semesterIds } },
    });
    const activities = await tx.activity.deleteMany({
      where: { categoryId: { in: categoryIds } },
    });
    const students = await tx.student.deleteMany({ where: { hallId } });

    return {
      auditLogs: auditLogs.count,
      uploads: uploads.count,
      snapshots: snapshots.count,
      enrollments: enrollments.count,
      activities: activities.count,
      students: students.count,
    };
  });

  for (const key of storageKeys) {
    deleteLocalStorageFile(key);
  }

  return summary;
}

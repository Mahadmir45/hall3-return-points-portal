import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { ensureCategoriesForSemester } from "../lib/db";

const prisma = new PrismaClient();

async function main() {
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

  for (const sem of [
    { code: "A", label: "Semester A" },
    { code: "B", label: "Semester B" },
  ]) {
    const semester = await prisma.semester.upsert({
      where: { academicYearId_code: { academicYearId: year.id, code: sem.code } },
      create: {
        academicYearId: year.id,
        code: sem.code,
        label: sem.label,
      },
      update: {},
    });
    await ensureCategoriesForSemester(semester.id);
  }

  const passwordHash = await bcrypt.hash("hall3dev", 10);

  await prisma.user.upsert({
    where: { email: "master@hall3.dev" },
    create: {
      email: "master@hall3.dev",
      name: "Hall Master",
      role: "MASTER",
      hallId: hall.id,
      passwordHash,
      emailVerified: new Date(),
    },
    update: { passwordHash, hallId: hall.id },
  });

  await prisma.user.upsert({
    where: { email: "tutor@hall3.dev" },
    create: {
      email: "tutor@hall3.dev",
      name: "Resident Tutor",
      role: "TUTOR",
      hallId: hall.id,
      passwordHash,
      emailVerified: new Date(),
    },
    update: { passwordHash, hallId: hall.id },
  });

  await prisma.user.upsert({
    where: { email: "admin@hall3.dev" },
    create: {
      email: "admin@hall3.dev",
      name: "Super Admin",
      role: "SUPER_ADMIN",
      passwordHash,
      emailVerified: new Date(),
    },
    update: { passwordHash },
  });

  await prisma.scoringRule.upsert({
    where: { id: "default-icfd-hall3" },
    create: {
      id: "default-icfd-hall3",
      hallId: hall.id,
      scope: "HALL",
      ruleJson: {
        type: "default",
        formula: "participation + extra + trainingCount",
        participantDefault: 2,
      },
    },
    update: {},
  });

  const categories = await prisma.category.findMany({
    where: { semester: { academicYear: { hallId: hall.id } } },
  });
  for (const cat of categories) {
    const ruleByCode: Record<string, object> = {
      EVENTS: { type: "event", participantDefault: 2 },
      ICFD: { type: "icfd", formula: "participation + extra + trainingCount" },
      FLOOR_REPS: { type: "floor_rep" },
      HSO: { type: "hso" },
    };
    await prisma.scoringRule.upsert({
      where: { id: `cat-rule-${cat.id}` },
      create: {
        id: `cat-rule-${cat.id}`,
        hallId: hall.id,
        scope: "CATEGORY",
        refId: cat.id,
        ruleJson: ruleByCode[cat.code] ?? { type: "default" },
      },
      update: {},
    });
  }

  // Demo: tutor also has access to a second hall (for multi-hall testing)
  const hall6 = await prisma.hall.upsert({
    where: { slug: "hall-6" },
    create: {
      code: "H6",
      slug: "hall-6",
      name: "Hall 6",
      address: "Shaw College, CUHK",
    },
    update: {},
  });

  const tutor = await prisma.user.findUnique({
    where: { email: "tutor@hall3.dev" },
  });
  if (tutor) {
    await prisma.userHall.upsert({
      where: { userId_hallId: { userId: tutor.id, hallId: hall6.id } },
      create: { userId: tutor.id, hallId: hall6.id },
      update: {},
    });
  }

  console.log("Seed complete:");
  console.log("  Hall:", hall.name);
  console.log("  master@hall3.dev / hall3dev (MASTER)");
  console.log("  tutor@hall3.dev / hall3dev (TUTOR)");
  console.log("  admin@hall3.dev / hall3dev (SUPER_ADMIN)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

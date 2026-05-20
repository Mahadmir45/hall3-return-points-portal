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
        type: "icfd",
        formula: "participation + extra + trainingCount",
        awards: { gold: 15, silver: 10, bronze: 5 },
      },
    },
    update: {},
  });

  console.log("Seed complete:");
  console.log("  Hall:", hall.name);
  console.log("  master@hall3.dev / hall3dev (MASTER)");
  console.log("  tutor@hall3.dev / hall3dev (TUTOR)");
  console.log("  admin@hall3.dev / hall3dev (SUPER_ADMIN)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

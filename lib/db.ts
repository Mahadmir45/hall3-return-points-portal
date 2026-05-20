import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const HALL_SCOPED_MODELS = new Set([
  "Student",
  "Upload",
  "AuditLog",
  "ScoringRule",
]);

type HallScopedModel = "Student" | "Upload" | "AuditLog" | "ScoringRule";

export function prismaForHall(hallId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (HALL_SCOPED_MODELS.has(model)) {
            args.where = { ...args.where, hallId };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (HALL_SCOPED_MODELS.has(model)) {
            args.where = { ...args.where, hallId };
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          if (HALL_SCOPED_MODELS.has(model)) {
            args.where = { ...args.where, hallId } as typeof args.where;
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (HALL_SCOPED_MODELS.has(model)) {
            args.where = { ...args.where, hallId };
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (HALL_SCOPED_MODELS.has(model)) {
            args.where = { ...args.where, hallId } as typeof args.where;
          }
          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (HALL_SCOPED_MODELS.has(model)) {
            args.where = { ...args.where, hallId };
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (HALL_SCOPED_MODELS.has(model)) {
            args.where = { ...args.where, hallId } as typeof args.where;
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (HALL_SCOPED_MODELS.has(model)) {
            args.where = { ...args.where, hallId };
          }
          return query(args);
        },
        async create({ model, args, query }) {
          if (HALL_SCOPED_MODELS.has(model as HallScopedModel)) {
            (args.data as { hallId?: string }).hallId = hallId;
          }
          return query(args);
        },
      },
    },
  });
}

export async function getHallBySlug(slug: string) {
  return prisma.hall.findUnique({ where: { slug } });
}

export async function getCurrentSemester(hallId: string) {
  const year = await prisma.academicYear.findFirst({
    where: { hallId },
    orderBy: { startDate: "desc" },
    include: {
      semesters: { orderBy: { code: "asc" } },
    },
  });
  if (!year || year.semesters.length === 0) return null;
  const semA = year.semesters.find((s) => s.code === "A");
  return { year, semester: semA ?? year.semesters[0] };
}

export async function ensureCategoriesForSemester(semesterId: string) {
  const defaults: { code: "EVENTS" | "ICFD" | "FLOOR_REPS" | "HSO"; name: string }[] = [
    { code: "EVENTS", name: "Events" },
    { code: "ICFD", name: "ICFD (Sports)" },
    { code: "FLOOR_REPS", name: "Floor Reps" },
    { code: "HSO", name: "HSO Performance" },
  ];

  for (const cat of defaults) {
    await prisma.category.upsert({
      where: { semesterId_code: { semesterId, code: cat.code } },
      create: { semesterId, code: cat.code, name: cat.name },
      update: { name: cat.name },
    });
  }
}

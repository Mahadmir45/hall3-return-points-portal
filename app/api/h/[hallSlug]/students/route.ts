import { auth, requireHallAccess, canEditRoster } from "@/lib/auth";
import { prisma, getHallBySlug } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hallSlug: string }> },
) {
  const { hallSlug } = await params;
  await requireHallAccess(hallSlug);
  const hall = await getHallBySlug(hallSlug);
  if (!hall) return NextResponse.json({ error: "Hall not found" }, { status: 404 });

  const { searchParams } = new URL(_req.url);
  const semesterId = searchParams.get("semesterId");
  const q = searchParams.get("q") ?? "";

  const enrollments = await prisma.enrollment.findMany({
    where: {
      semesterId: semesterId ?? undefined,
      student: {
        hallId: hall.id,
        OR: q
          ? [
              { nameFull: { contains: q, mode: "insensitive" } },
              { sid: { contains: q } },
            ]
          : undefined,
      },
    },
    include: { student: true },
    orderBy: { student: { nameFull: "asc" } },
    take: 500,
  });

  return NextResponse.json(
    enrollments.map((e) => ({
      id: e.student.id,
      sid: e.student.sid,
      nameFull: e.student.nameFull,
      roomCode: e.roomCode,
      bedNo: e.bedNo,
      status: e.status,
      enrollmentId: e.id,
    })),
  );
}

const createSchema = z.object({
  sid: z.string().min(7),
  nameFull: z.string().min(1),
  roomCode: z.string().min(1),
  semesterId: z.string(),
  bedNo: z.string().optional(),
  gender: z.string().optional(),
  programYear: z.number().optional(),
  program: z.string().optional(),
  country: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string }> },
) {
  const { hallSlug } = await params;
  const session = await requireHallAccess(hallSlug);
  if (!canEditRoster(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const hall = await getHallBySlug(hallSlug);
  if (!hall) return NextResponse.json({ error: "Hall not found" }, { status: 404 });

  const body = createSchema.parse(await req.json());

  const student = await prisma.student.upsert({
    where: { hallId_sid: { hallId: hall.id, sid: body.sid } },
    create: {
      hallId: hall.id,
      sid: body.sid,
      nameFull: body.nameFull,
      gender: body.gender,
      programYear: body.programYear,
      program: body.program,
      country: body.country,
    },
    update: {
      nameFull: body.nameFull,
      gender: body.gender,
      programYear: body.programYear,
      program: body.program,
      country: body.country,
    },
  });

  const enrollment = await prisma.enrollment.upsert({
    where: {
      studentId_semesterId: {
        studentId: student.id,
        semesterId: body.semesterId,
      },
    },
    create: {
      studentId: student.id,
      semesterId: body.semesterId,
      roomCode: body.roomCode,
      bedNo: body.bedNo,
    },
    update: {
      roomCode: body.roomCode,
      bedNo: body.bedNo,
    },
  });

  return NextResponse.json({ student, enrollment }, { status: 201 });
}

import { requireHallAccess, canFinalize } from "@/lib/auth";
import { prisma, getHallBySlug } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string }> },
) {
  const { hallSlug } = await params;
  await requireHallAccess(hallSlug);
  const hall = await getHallBySlug(hallSlug);
  if (!hall) return NextResponse.json({ error: "Hall not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const semesterId = searchParams.get("semesterId");
  if (!semesterId) {
    return NextResponse.json({ error: "semesterId required" }, { status: 400 });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { semesterId },
    include: { student: true },
    orderBy: { student: { nameFull: "asc" } },
  });

  const categories = await prisma.category.findMany({
    where: { semesterId },
  });

  const categoryIds = categories.map((c) => c.id);
  const activities = await prisma.activity.findMany({
    where: { categoryId: { in: categoryIds } },
    include: { category: true },
  });

  const activityIds = activities.map((a) => a.id);
  const participants = await prisma.activityParticipant.findMany({
    where: {
      activityId: { in: activityIds },
      studentId: { not: null },
    },
  });

  const totals = enrollments.map((e) => {
    const studentParts = participants.filter((p) => p.studentId === e.student.id);
    const byCategory: Record<string, number> = {};
    let grandTotal = 0;

    for (const cat of categories) {
      const catActivityIds = activities
        .filter((a) => a.categoryId === cat.id)
        .map((a) => a.id);
      const sum = studentParts
        .filter((p) => catActivityIds.includes(p.activityId))
        .reduce((acc, p) => acc + p.computedPoints, 0);
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

  return NextResponse.json({ totals, categories });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string }> },
) {
  const { hallSlug } = await params;
  const session = await requireHallAccess(hallSlug);
  if (!canFinalize(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { semesterId } = await req.json();
  if (!semesterId) {
    return NextResponse.json({ error: "semesterId required" }, { status: 400 });
  }

  const data = await GET(
    new Request(`http://local/api/h/${hallSlug}/points?semesterId=${semesterId}`),
    { params: Promise.resolve({ hallSlug }) },
  ).then((r) => r.json());

  await prisma.semesterSnapshot.upsert({
    where: { semesterId },
    create: {
      semesterId,
      payloadJson: data,
      finalizedById: session.user.id,
    },
    update: {
      payloadJson: data,
      finalizedById: session.user.id,
      finalizedAt: new Date(),
    },
  });

  const categories = await prisma.category.findMany({ where: { semesterId } });
  const categoryIds = categories.map((c) => c.id);
  await prisma.activity.updateMany({
    where: { categoryId: { in: categoryIds } },
    data: { status: "FINALIZED" },
  });

  return NextResponse.json({ ok: true });
}

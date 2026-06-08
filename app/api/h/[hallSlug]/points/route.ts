import { requireHallAccess, canFinalize } from "@/lib/auth";
import { prisma, getHallBySlug } from "@/lib/db";
import { tabulateSemesterPoints } from "@/lib/scoring/tabulatePoints";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

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

  const data = await tabulateSemesterPoints(hall.id, semesterId);
  return NextResponse.json(data);
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

  const hall = await getHallBySlug(hallSlug);
  if (!hall) return NextResponse.json({ error: "Hall not found" }, { status: 404 });

  const { semesterId } = await req.json();
  if (!semesterId) {
    return NextResponse.json({ error: "semesterId required" }, { status: 400 });
  }

  const data = await tabulateSemesterPoints(hall.id, semesterId);
  const payload = data as unknown as Prisma.InputJsonValue;

  await prisma.semesterSnapshot.upsert({
    where: { semesterId },
    create: {
      semesterId,
      payloadJson: payload,
      finalizedById: session.user.id,
    },
    update: {
      payloadJson: payload,
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

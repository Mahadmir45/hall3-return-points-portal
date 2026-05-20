import { requireHallAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computePoints } from "@/lib/scoring/rules";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hallSlug: string; activityId: string }> },
) {
  const { hallSlug, activityId } = await params;
  await requireHallAccess(hallSlug);

  const participants = await prisma.activityParticipant.findMany({
    where: { activityId },
    include: { student: true },
    orderBy: { rawName: "asc" },
  });

  return NextResponse.json(participants);
}

const upsertSchema = z.object({
  studentId: z.string().optional(),
  rawName: z.string().optional(),
  rawSid: z.string().optional(),
  rawRoom: z.string().optional(),
  roleCode: z.string(),
  basePoints: z.number(),
  extraPoints: z.number().optional(),
  rating: z.number().optional(),
  notes: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string; activityId: string }> },
) {
  const { hallSlug, activityId } = await params;
  await requireHallAccess(hallSlug);

  const body = upsertSchema.parse(await req.json());
  const computedPoints = computePoints({
    basePoints: body.basePoints,
    extraPoints: body.extraPoints ?? 0,
    rating: body.rating,
  });

  const participant = await prisma.activityParticipant.create({
    data: {
      activityId,
      studentId: body.studentId,
      rawName: body.rawName,
      rawSid: body.rawSid,
      rawRoom: body.rawRoom,
      roleCode: body.roleCode as never,
      basePoints: body.basePoints,
      extraPoints: body.extraPoints ?? 0,
      rating: body.rating,
      computedPoints,
      isResolved: !!body.studentId,
      notes: body.notes,
    },
  });

  return NextResponse.json(participant, { status: 201 });
}

const patchSchema = z.object({
  id: z.string(),
  basePoints: z.number().optional(),
  extraPoints: z.number().optional(),
  rating: z.number().optional(),
  notes: z.string().optional(),
  roleCode: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string; activityId: string }> },
) {
  const { hallSlug, activityId } = await params;
  await requireHallAccess(hallSlug);

  const body = patchSchema.parse(await req.json());
  const existing = await prisma.activityParticipant.findFirst({
    where: { id: body.id, activityId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const computedPoints = computePoints({
    basePoints: body.basePoints ?? existing.basePoints,
    extraPoints: body.extraPoints ?? existing.extraPoints,
    rating: body.rating ?? existing.rating,
  });

  const updated = await prisma.activityParticipant.update({
    where: { id: body.id },
    data: {
      basePoints: body.basePoints,
      extraPoints: body.extraPoints,
      rating: body.rating,
      notes: body.notes,
      roleCode: body.roleCode as never,
      computedPoints,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string; activityId: string }> },
) {
  const { hallSlug, activityId } = await params;
  await requireHallAccess(hallSlug);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.activityParticipant.deleteMany({ where: { id, activityId } });
  return NextResponse.json({ ok: true });
}

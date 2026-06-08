import { requireHallAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { computeParticipantPointsFromRules } from "@/lib/scoring/recomputeParticipantPoints";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  id: z.string(),
  rawName: z.string().optional(),
  rawSid: z.string().optional(),
  rawRoom: z.string().optional(),
  roleCode: z.string().optional(),
  basePoints: z.number().optional(),
  extraPoints: z.number().optional(),
  rating: z.number().nullable().optional(),
  computedPoints: z.number().optional(),
  notes: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string; uploadId: string }> },
) {
  const { hallSlug, uploadId } = await params;
  await requireHallAccess(hallSlug);

  const upload = await prisma.upload.findFirst({
    where: { id: uploadId, hall: { slug: hallSlug } },
    include: {
      activity: { include: { category: true } },
    },
  });
  if (!upload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = patchSchema.parse(await req.json());
  const existing = await prisma.participantStaging.findFirst({
    where: { id: body.id, uploadId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Staging row not found" }, { status: 404 });
  }

  const basePoints = body.basePoints ?? existing.basePoints;
  const extraPoints = body.extraPoints ?? existing.extraPoints;
  const rating = body.rating !== undefined ? body.rating : existing.rating;

  let computedPoints = body.computedPoints;
  if (computedPoints === undefined && upload.activity) {
    const rules = await prisma.scoringRule.findMany({
      where: { hallId: upload.hallId },
    });
    computedPoints = computeParticipantPointsFromRules({
      activityType: upload.activity.type,
      categoryId: upload.activity.categoryId,
      basePoints,
      extraPoints,
      rating,
      rules,
    });
  } else if (computedPoints === undefined) {
    computedPoints = basePoints + extraPoints;
  }

  const updated = await prisma.participantStaging.update({
    where: { id: body.id },
    data: {
      rawName: body.rawName ?? existing.rawName,
      rawSid: body.rawSid ?? existing.rawSid,
      rawRoom: body.rawRoom ?? existing.rawRoom,
      roleCode: (body.roleCode as never) ?? existing.roleCode,
      basePoints,
      extraPoints,
      rating,
      computedPoints,
      notes: body.notes !== undefined ? body.notes : existing.notes,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string; uploadId: string }> },
) {
  const { hallSlug, uploadId } = await params;
  await requireHallAccess(hallSlug);

  const upload = await prisma.upload.findFirst({
    where: { id: uploadId, hall: { slug: hallSlug } },
  });
  if (!upload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.participantStaging.deleteMany({ where: { id, uploadId } });

  const remaining = await prisma.participantStaging.count({ where: { uploadId } });
  await prisma.upload.update({
    where: { id: uploadId },
    data: {
      parseLogJson: {
        ...((upload.parseLogJson as Record<string, unknown> | null) ?? {}),
        matched: remaining,
      },
    },
  });

  return NextResponse.json({ ok: true, remaining });
}

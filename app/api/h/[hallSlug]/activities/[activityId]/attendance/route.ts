import { requireHallAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recomputeAndSaveParticipantPoints } from "@/lib/scoring/recomputeParticipantPoints";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hallSlug: string; activityId: string }> },
) {
  const { hallSlug, activityId } = await params;
  await requireHallAccess(hallSlug);

  const sessions = await prisma.activitySession.findMany({
    where: { activityId },
    orderBy: { sortOrder: "asc" },
  });

  const participants = await prisma.activityParticipant.findMany({
    where: { activityId },
    include: {
      student: true,
      attendance: { include: { session: true } },
    },
  });

  return NextResponse.json({ sessions, participants });
}

const attendanceSchema = z.object({
  sessionId: z.string(),
  participantId: z.string(),
  attended: z.boolean(),
  notes: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string; activityId: string }> },
) {
  const { hallSlug, activityId } = await params;
  await requireHallAccess(hallSlug);

  const body = attendanceSchema.parse(await req.json());

  const participant = await prisma.activityParticipant.findFirst({
    where: { id: body.participantId, activityId },
  });
  if (!participant) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  const record = await prisma.attendance.upsert({
    where: {
      sessionId_participantId: {
        sessionId: body.sessionId,
        participantId: body.participantId,
      },
    },
    create: {
      sessionId: body.sessionId,
      participantId: body.participantId,
      attended: body.attended,
      notes: body.notes,
    },
    update: {
      attended: body.attended,
      notes: body.notes,
    },
  });

  await recomputeAndSaveParticipantPoints(body.participantId);

  return NextResponse.json(record);
}

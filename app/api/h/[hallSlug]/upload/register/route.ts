import { requireHallAccess } from "@/lib/auth";
import { prisma, getHallBySlug } from "@/lib/db";
import { enqueueParseJob } from "@/lib/queue";
import { processUpload } from "@/lib/excel/processUpload";
import { detectUploadKind } from "@/lib/excel/detectKind";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { UploadKind } from "@prisma/client";

const schema = z.object({
  storageKey: z.string().min(1),
  originalFilename: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
  kind: z.string().optional(),
  semesterId: z.string().optional(),
  activityId: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string }> },
) {
  const { hallSlug } = await params;
  const session = await requireHallAccess(hallSlug);
  const hall = await getHallBySlug(hallSlug);
  if (!hall) return NextResponse.json({ error: "Hall not found" }, { status: 404 });

  const body = schema.parse(await req.json());
  const kind = (body.kind ??
    detectUploadKind(body.originalFilename)) as UploadKind;

  const upload = await prisma.upload.create({
    data: {
      hallId: hall.id,
      semesterId: body.semesterId,
      activityId: body.activityId,
      kind,
      originalFilename: body.originalFilename,
      storageKey: body.storageKey,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      uploadedById: session.user.id,
      parseStatus: "PENDING",
    },
  });

  try {
    const useQueue = process.env.ENABLE_QUEUE === "true";
    if (useQueue) {
      await enqueueParseJob(upload.id);
    } else {
      await processUpload(upload.id);
    }
  } catch {
    await processUpload(upload.id);
  }

  const updated = await prisma.upload.findUnique({ where: { id: upload.id } });
  return NextResponse.json(updated ?? upload, { status: 201 });
}

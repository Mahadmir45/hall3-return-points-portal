import { requireHallAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteUploadById } from "@/lib/admin/deleteResources";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hallSlug: string; uploadId: string }> },
) {
  const { hallSlug, uploadId } = await params;
  await requireHallAccess(hallSlug);

  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
    include: {
      staging: { orderBy: { rowIndex: "asc" } },
    },
  });

  if (!upload) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(upload);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ hallSlug: string; uploadId: string }> },
) {
  const { hallSlug, uploadId } = await params;
  await requireHallAccess(hallSlug);

  const hall = await prisma.hall.findUnique({ where: { slug: hallSlug } });
  if (!hall) return NextResponse.json({ error: "Hall not found" }, { status: 404 });

  const deleted = await deleteUploadById(uploadId, hall.id);
  if (!deleted) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

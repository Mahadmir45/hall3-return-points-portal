import { requireHallAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { applyUpload } from "@/lib/excel/processUpload";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ hallSlug: string; uploadId: string }> },
) {
  const { hallSlug, uploadId } = await params;
  const session = await requireHallAccess(hallSlug);

  const upload = await prisma.upload.findUnique({ where: { id: uploadId } });
  if (!upload) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (upload.kind === "ROSTER") {
    return NextResponse.json({
      message: "Roster uploads are applied automatically during parse",
      upload,
    });
  }

  await applyUpload(uploadId, session.user.id);

  const updated = await prisma.upload.findUnique({ where: { id: uploadId } });
  return NextResponse.json(updated);
}

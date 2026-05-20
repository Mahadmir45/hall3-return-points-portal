import { requireHallAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
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

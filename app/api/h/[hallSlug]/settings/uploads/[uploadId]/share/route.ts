import { NextResponse } from "next/server";
import { requireHallAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ hallSlug: string; uploadId: string }> },
) {
  try {
    const { hallSlug, uploadId } = await params;
    const session = await requireHallAccess(hallSlug);
    const body = (await request.json()) as { sharedWithUserIds?: string[] };

    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      include: { hall: true },
    });

    if (!upload || upload.hall.slug !== hallSlug) {
      return NextResponse.json({ error: "Upload not found." }, { status: 404 });
    }

    if (upload.uploadedById !== session.user.id) {
      return NextResponse.json(
        { error: "Only the uploader can change file access." },
        { status: 403 },
      );
    }

    const sharedWithUserIds = Array.isArray(body.sharedWithUserIds)
      ? body.sharedWithUserIds.filter((id) => id !== session.user.id)
      : [];

    const validUsers = await prisma.user.count({
      where: {
        hallId: upload.hallId,
        id: { in: sharedWithUserIds },
      },
    });
    if (validUsers !== sharedWithUserIds.length) {
      return NextResponse.json(
        { error: "One or more selected users are invalid." },
        { status: 400 },
      );
    }

    await prisma.upload.update({
      where: { id: uploadId },
      data: { sharedWithUserIds },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

import { requireHallAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteActivityById } from "@/lib/admin/deleteResources";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ hallSlug: string; activityId: string }> },
) {
  const { hallSlug, activityId } = await params;
  await requireHallAccess(hallSlug);

  const hall = await prisma.hall.findUnique({ where: { slug: hallSlug } });
  if (!hall) return NextResponse.json({ error: "Hall not found" }, { status: 404 });

  const activity = await prisma.activity.findFirst({
    where: {
      id: activityId,
      category: { semester: { academicYear: { hallId: hall.id } } },
    },
    select: { id: true, status: true },
  });
  if (!activity) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  const deleted = await deleteActivityById(activityId, hall.id);
  return NextResponse.json({ ok: true, id: deleted });
}

import { requireHallAccess, canFinalize } from "@/lib/auth";
import { clearHallData } from "@/lib/admin/clearHallData";
import { getHallBySlug } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  confirmPhrase: z.string(),
});

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
  if (!hall) {
    return NextResponse.json({ error: "Hall not found" }, { status: 404 });
  }

  const { confirmPhrase } = bodySchema.parse(await req.json());
  if (confirmPhrase !== hall.slug) {
    return NextResponse.json(
      { error: `Type the hall slug "${hall.slug}" to confirm` },
      { status: 400 },
    );
  }

  const summary = await clearHallData(hall.id);

  await logAudit({
    hallId: hall.id,
    userId: session.user.id,
    action: "CLEAR_HALL_DATA",
    entityType: "Hall",
    entityId: hall.id,
    diffJson: summary,
  });

  return NextResponse.json({ ok: true, summary });
}

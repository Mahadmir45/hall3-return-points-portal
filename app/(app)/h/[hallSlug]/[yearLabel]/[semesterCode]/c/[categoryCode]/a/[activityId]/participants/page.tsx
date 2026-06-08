import { requireHallAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ParticipantsPageClient } from "@/components/activity/participants-page-client";

export default async function ActivityParticipantsPage({
  params,
}: {
  params: Promise<{ hallSlug: string; activityId: string }>;
}) {
  const { hallSlug, activityId } = await params;
  await requireHallAccess(hallSlug);

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { status: true },
  });

  return (
    <ParticipantsPageClient
      hallSlug={hallSlug}
      activityId={activityId}
      readOnly={activity?.status === "FINALIZED"}
    />
  );
}

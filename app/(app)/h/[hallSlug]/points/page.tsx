import { auth, requireHallAccess, canFinalize } from "@/lib/auth";
import { getHallBySlug, getCurrentSemester } from "@/lib/db";
import { AppShell, Breadcrumb } from "@/components/layout/app-shell";
import { PointsPageClient } from "@/components/points/points-table";

export default async function PointsPage({
  params,
}: {
  params: Promise<{ hallSlug: string }>;
}) {
  const { hallSlug } = await params;
  const session = await requireHallAccess(hallSlug);
  const hall = await getHallBySlug(hallSlug);
  if (!hall) return null;

  const current = await getCurrentSemester(hall.id);

  return (
    <AppShell hallName={hall.name} hallSlug={hallSlug} userName={session.user.name}>
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: `/h/${hallSlug}` },
            { label: "Points" },
          ]}
        />
        <h2 className="text-2xl font-bold">Points Tabulation</h2>
        {current ? (
          <PointsPageClient
            semesterId={current.semester.id}
            canFinalize={canFinalize(session.user.role)}
          />
        ) : (
          <p className="text-slate-500">No semester configured</p>
        )}
      </div>
    </AppShell>
  );
}

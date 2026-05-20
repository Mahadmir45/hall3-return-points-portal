import { requireHallAccess } from "@/lib/auth";
import { prisma, getHallBySlug } from "@/lib/db";
import { AppShell, Breadcrumb } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AuditPage({
  params,
}: {
  params: Promise<{ hallSlug: string }>;
}) {
  const { hallSlug } = await params;
  const session = await requireHallAccess(hallSlug);
  const hall = await getHallBySlug(hallSlug);
  if (!hall) return null;

  const logs = await prisma.auditLog.findMany({
    where: { hallId: hall.id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AppShell hallName={hall.name} hallSlug={hallSlug} userName={session.user.name}>
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: `/h/${hallSlug}` },
            { label: "Audit Log" },
          ]}
        />
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <Card>
          <CardHeader>
            <CardTitle>Recent actions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {logs.map((log) => (
                <li key={log.id} className="flex justify-between py-2">
                  <span>
                    {log.action} · {log.entityType}
                    {log.entityId ? ` (${log.entityId.slice(0, 8)}…)` : ""}
                  </span>
                  <span className="text-slate-500">
                    {log.user.name ?? log.user.email} ·{" "}
                    {log.createdAt.toLocaleString()}
                  </span>
                </li>
              ))}
              {logs.length === 0 && (
                <p className="text-slate-500">No audit entries yet</p>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

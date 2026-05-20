import { requireHallAccess, canManageUsers } from "@/lib/auth";
import { prisma, getHallBySlug } from "@/lib/db";
import { AppShell, Breadcrumb } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";

export default async function SettingsHallPage({
  params,
}: {
  params: Promise<{ hallSlug: string }>;
}) {
  const { hallSlug } = await params;
  const session = await requireHallAccess(hallSlug);
  if (!canManageUsers(session.user.role)) {
    redirect(`/h/${hallSlug}`);
  }

  const hall = await getHallBySlug(hallSlug);
  if (!hall) return null;

  const users = await prisma.user.findMany({
    where: { hallId: hall.id },
    orderBy: { email: "asc" },
  });

  const rules = await prisma.scoringRule.findMany({
    where: { hallId: hall.id },
  });

  return (
    <AppShell hallName={hall.name} hallSlug={hallSlug} userName={session.user.name}>
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: `/h/${hallSlug}` },
            { label: "Settings" },
          ]}
        />
        <h2 className="text-2xl font-bold">Hall Settings</h2>

        <Card>
          <CardHeader>
            <CardTitle>Hall info</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Name: {hall.name}</p>
            <p>Code: {hall.code}</p>
            <p>Slug: {hall.slug}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {users.map((u) => (
                <li key={u.id} className="flex justify-between py-2">
                  <span>{u.email}</span>
                  <span className="text-slate-500">
                    {u.role} · {u.name}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scoring rules</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded bg-slate-100 p-3 text-xs">
              {JSON.stringify(rules, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

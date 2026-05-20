import { auth, requireHallAccess } from "@/lib/auth";
import { prisma, getCurrentSemester } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { slugifyYear } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function HallDashboardPage({
  params,
}: {
  params: Promise<{ hallSlug: string }>;
}) {
  const { hallSlug } = await params;
  await requireHallAccess(hallSlug);

  const hall = await prisma.hall.findUnique({ where: { slug: hallSlug } });
  if (!hall) redirect("/signin");

  const session = await auth();
  const current = await getCurrentSemester(hall.id);

  const [studentCount, activityCount, pendingUploads] = await Promise.all([
    current
      ? prisma.enrollment.count({ where: { semesterId: current.semester.id } })
      : 0,
    current
      ? prisma.activity.count({
          where: {
            category: { semesterId: current.semester.id },
          },
        })
      : 0,
    prisma.upload.count({
      where: {
        hallId: hall.id,
        parseStatus: { in: ["PENDING", "PARTIAL"] },
      },
    }),
  ]);

  const recentUploads = await prisma.upload.findMany({
    where: { hallId: hall.id },
    orderBy: { uploadedAt: "desc" },
    take: 5,
    include: { uploadedBy: { select: { name: true } } },
  });

  return (
    <AppShell
      hallName={hall.name}
      hallSlug={hallSlug}
      userName={session?.user?.name}
    >
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-600">
            {current
              ? `${current.year.label} · ${current.semester.label}`
              : "No academic year configured"}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Residents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{studentCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activities</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{activityCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pending uploads</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{pendingUploads}</p>
            </CardContent>
          </Card>
        </div>

        {current && (
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    ["EVENTS", "Events"],
                    ["ICFD", "ICFD (Sports)"],
                    ["FLOOR_REPS", "Floor Reps"],
                    ["HSO", "HSO Performance"],
                  ] as const
                ).map(([code, label]) => (
                  <Link
                    key={code}
                    href={`/h/${hallSlug}/${slugifyYear(current.year.label)}/${current.semester.code}/c/${code}`}
                    className="rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50"
                  >
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-slate-500">Open folder →</p>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Recent uploads</CardTitle>
          </CardHeader>
          <CardContent>
            {recentUploads.length === 0 ? (
              <p className="text-sm text-slate-500">No uploads yet</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentUploads.map((u) => (
                  <li key={u.id} className="flex justify-between py-2 text-sm">
                    <span>{u.originalFilename}</span>
                    <span className="text-slate-500">
                      {u.parseStatus} · {u.uploadedBy.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

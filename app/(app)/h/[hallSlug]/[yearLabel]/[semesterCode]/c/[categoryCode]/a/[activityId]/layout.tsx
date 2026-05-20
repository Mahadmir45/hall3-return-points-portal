import { requireHallAccess } from "@/lib/auth";
import { prisma, getHallBySlug } from "@/lib/db";
import { AppShell, Breadcrumb } from "@/components/layout/app-shell";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ActivityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{
    hallSlug: string;
    yearLabel: string;
    semesterCode: string;
    categoryCode: string;
    activityId: string;
  }>;
}) {
  const p = await params;
  const session = await requireHallAccess(p.hallSlug);
  const hall = await getHallBySlug(p.hallSlug);
  if (!hall) notFound();

  const activity = await prisma.activity.findUnique({
    where: { id: p.activityId },
    include: {
      category: true,
      _count: { select: { participants: true, uploads: true } },
    },
  });
  if (!activity) notFound();

  const base = `/h/${p.hallSlug}/${p.yearLabel}/${p.semesterCode}/c/${p.categoryCode}/a/${p.activityId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/participants`, label: "Participants" },
    ...(activity.type === "SPORT" || activity.type === "HSO_TERM"
      ? [{ href: `${base}/attendance`, label: "Attendance" }]
      : []),
    { href: `${base}/files`, label: "Files" },
  ];

  return (
    <AppShell hallName={hall.name} hallSlug={p.hallSlug} userName={session.user.name}>
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: `/h/${p.hallSlug}` },
            {
              label: activity.category.name,
              href: `/h/${p.hallSlug}/${p.yearLabel}/${p.semesterCode}/c/${p.categoryCode}`,
            },
            { label: activity.name },
          ]}
        />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{activity.name}</h2>
            <p className="text-sm text-slate-500">
              {activity.status} · {activity._count.participants} participants ·{" "}
              {activity._count.uploads} uploads
            </p>
          </div>
        </div>
        <nav className="flex gap-1 border-b border-slate-200">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-600 hover:border-blue-500 hover:text-blue-600"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </AppShell>
  );
}

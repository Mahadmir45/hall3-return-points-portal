import { requireHallAccess } from "@/lib/auth";
import { prisma, getHallBySlug } from "@/lib/db";
import { AppShell, Breadcrumb } from "@/components/layout/app-shell";
import { parseYearSlug } from "@/lib/utils";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function CategoryActivitiesPage({
  params,
}: {
  params: Promise<{
    hallSlug: string;
    yearLabel: string;
    semesterCode: string;
    categoryCode: string;
  }>;
}) {
  const { hallSlug, yearLabel, semesterCode, categoryCode } = await params;
  const session = await requireHallAccess(hallSlug);
  const hall = await getHallBySlug(hallSlug);
  if (!hall) return null;

  const label = parseYearSlug(yearLabel);
  const category = await prisma.category.findFirst({
    where: {
      code: categoryCode as never,
      semester: {
        code: semesterCode,
        academicYear: { hallId: hall.id, label },
      },
    },
    include: {
      activities: {
        orderBy: [{ sortKey: "asc" }, { name: "asc" }],
        include: { _count: { select: { participants: true } } },
      },
      semester: { include: { academicYear: true } },
    },
  });

  if (!category) {
    return (
      <AppShell hallName={hall.name} hallSlug={hallSlug} userName={session.user.name}>
        <p>Category not found</p>
      </AppShell>
    );
  }

  const base = `/h/${hallSlug}/${yearLabel}/${semesterCode}/c/${categoryCode}`;

  return (
    <AppShell hallName={hall.name} hallSlug={hallSlug} userName={session.user.name}>
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: `/h/${hallSlug}` },
            {
              label: "Categories",
              href: `/h/${hallSlug}/${yearLabel}/${semesterCode}/categories`,
            },
            { label: category.name },
          ]}
        />
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{category.name}</h2>
          <Link href={`${base}/new`}>
            <Button>New activity</Button>
          </Link>
        </div>
        <div className="grid gap-3">
          {category.activities.map((a) => (
            <Link key={a.id} href={`${base}/a/${a.id}`}>
              <Card className="hover:border-blue-300">
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {a.sortKey !== "00" ? `${a.sortKey}. ` : ""}
                      {a.name}
                    </CardTitle>
                    <span className="text-xs text-slate-500">{a.status}</span>
                  </div>
                </CardHeader>
                <CardContent className="pb-4 pt-0">
                  <p className="text-sm text-slate-500">
                    {a._count.participants} participants
                    {a.date
                      ? ` · ${a.date.toLocaleDateString()}`
                      : ""}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {category.activities.length === 0 && (
            <p className="text-sm text-slate-500">No activities in this folder yet.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}

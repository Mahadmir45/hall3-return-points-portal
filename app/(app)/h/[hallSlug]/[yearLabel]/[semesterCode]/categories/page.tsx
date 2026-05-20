import { requireHallAccess } from "@/lib/auth";
import { prisma, getHallBySlug } from "@/lib/db";
import { AppShell, Breadcrumb } from "@/components/layout/app-shell";
import { parseYearSlug } from "@/lib/utils";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORY_LABELS: Record<string, string> = {
  EVENTS: "Events",
  ICFD: "ICFD (Sports)",
  FLOOR_REPS: "Floor Reps",
  HSO: "HSO Performance",
};

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{
    hallSlug: string;
    yearLabel: string;
    semesterCode: string;
  }>;
}) {
  const { hallSlug, yearLabel, semesterCode } = await params;
  const session = await requireHallAccess(hallSlug);
  const hall = await getHallBySlug(hallSlug);
  if (!hall) return null;

  const label = parseYearSlug(yearLabel);
  const year = await prisma.academicYear.findFirst({
    where: { hallId: hall.id, label },
    include: {
      semesters: {
        where: { code: semesterCode },
        include: { categories: true },
      },
    },
  });

  const semester = year?.semesters[0];
  if (!semester) {
    return (
      <AppShell hallName={hall.name} hallSlug={hallSlug} userName={session.user.name}>
        <p>Semester not found</p>
      </AppShell>
    );
  }

  return (
    <AppShell hallName={hall.name} hallSlug={hallSlug} userName={session.user.name}>
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: `/h/${hallSlug}` },
            { label: `${label} ${semesterCode}` },
            { label: "Categories" },
          ]}
        />
        <h2 className="text-2xl font-bold">Categories</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {semester.categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/h/${hallSlug}/${yearLabel}/${semesterCode}/c/${cat.code}`}
            >
              <Card className="hover:border-blue-300 hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle>{CATEGORY_LABELS[cat.code] ?? cat.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500">Open folder →</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

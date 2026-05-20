import { requireHallAccess } from "@/lib/auth";
import { prisma, getHallBySlug } from "@/lib/db";
import { AppShell, Breadcrumb } from "@/components/layout/app-shell";
import Link from "next/link";

export default async function StudentPointsPage({
  params,
  searchParams,
}: {
  params: Promise<{ hallSlug: string; studentId: string }>;
  searchParams: Promise<{ semesterId?: string }>;
}) {
  const { hallSlug, studentId } = await params;
  const { semesterId } = await searchParams;
  const session = await requireHallAccess(hallSlug);
  const hall = await getHallBySlug(hallSlug);
  if (!hall) return null;

  const student = await prisma.student.findFirst({
    where: { id: studentId, hallId: hall.id },
  });
  if (!student) return null;

  const participants = await prisma.activityParticipant.findMany({
    where: {
      studentId,
      activity: semesterId
        ? { category: { semesterId } }
        : undefined,
    },
    include: {
      activity: { include: { category: true } },
    },
    orderBy: { activity: { name: "asc" } },
  });

  const total = participants.reduce((s, p) => s + p.computedPoints, 0);

  return (
    <AppShell hallName={hall.name} hallSlug={hallSlug} userName={session.user.name}>
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: `/h/${hallSlug}` },
            { label: "Points", href: `/h/${hallSlug}/points` },
            { label: student.nameFull },
          ]}
        />
        <div>
          <h2 className="text-2xl font-bold">{student.nameFull}</h2>
          <p className="text-slate-500">
            SID {student.sid} · Total {total.toFixed(1)} pts
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Activity</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Points</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">{p.activity.name}</td>
                  <td className="px-3 py-2">{p.activity.category.name}</td>
                  <td className="px-3 py-2">{p.roleCode}</td>
                  <td className="px-3 py-2">{p.computedPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

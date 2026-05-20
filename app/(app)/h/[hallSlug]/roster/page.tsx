import { auth, requireHallAccess, canEditRoster } from "@/lib/auth";
import { prisma, getHallBySlug, getCurrentSemester } from "@/lib/db";
import { AppShell, Breadcrumb } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUploader } from "@/components/upload/file-uploader";
import Link from "next/link";

export default async function RosterPage({
  params,
}: {
  params: Promise<{ hallSlug: string }>;
}) {
  const { hallSlug } = await params;
  const session = await requireHallAccess(hallSlug);
  const hall = await getHallBySlug(hallSlug);
  if (!hall) return null;

  const current = await getCurrentSemester(hall.id);
  const semesterId = current?.semester.id;

  const enrollments = semesterId
    ? await prisma.enrollment.findMany({
        where: { semesterId },
        include: { student: true },
        orderBy: { student: { nameFull: "asc" } },
        take: 200,
      })
    : [];

  return (
    <AppShell
      hallName={hall.name}
      hallSlug={hallSlug}
      userName={session.user.name}
    >
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: `/h/${hallSlug}` },
            { label: "Roster" },
          ]}
        />
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Master Roster</h2>
          {canEditRoster(session.user.role) && semesterId && (
            <FileUploader
              hallSlug={hallSlug}
              kind="ROSTER"
              semesterId={semesterId}
            />
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {current
                ? `${current.year.label} · ${current.semester.label}`
                : "No semester"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">SID</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Room</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{e.student.sid}</td>
                      <td className="py-2 pr-4">{e.student.nameFull}</td>
                      <td className="py-2 pr-4">{e.roomCode}</td>
                      <td className="py-2 pr-4">{e.status ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {enrollments.length === 0 && (
                <p className="text-sm text-slate-500">
                  Upload SemA-List or SemB-List Excel to populate roster.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

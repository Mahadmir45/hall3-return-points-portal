import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUploader } from "@/components/upload/file-uploader";
import Link from "next/link";

export default async function ActivityOverviewPage({
  params,
}: {
  params: Promise<{
    hallSlug: string;
    yearLabel: string;
    semesterCode: string;
    categoryCode: string;
    activityId: string;
  }>;
}) {
  const p = await params;

  const activity = await prisma.activity.findUnique({
    where: { id: p.activityId },
    include: {
      uploads: { orderBy: { uploadedAt: "desc" }, take: 5 },
    },
  });

  if (!activity) return null;

  const uploadKind =
    p.categoryCode === "ICFD"
      ? "ICFD_REPORT"
      : p.categoryCode === "FLOOR_REPS"
        ? "FLOOR_REP_SHEET"
        : p.categoryCode === "HSO"
          ? "HSO_SHEET"
          : "RLA_REPORT";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-slate-500">Type:</span> {activity.type}
            </p>
            <p>
              <span className="text-slate-500">Date:</span>{" "}
              {activity.date?.toLocaleDateString() ?? "—"}
            </p>
            <p>
              <span className="text-slate-500">External code:</span>{" "}
              {activity.externalCode ?? "—"}
            </p>
            <p>
              <span className="text-slate-500">Description:</span>{" "}
              {activity.description ?? "—"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload RLA Report</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUploader
              hallSlug={p.hallSlug}
              kind={uploadKind}
              activityId={p.activityId}
              redirectAfterUpload={`/h/${p.hallSlug}/${p.yearLabel}/${p.semesterCode}/c/${p.categoryCode}/a/${p.activityId}`}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent uploads</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {activity.uploads.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/h/${p.hallSlug}/${p.yearLabel}/${p.semesterCode}/c/${p.categoryCode}/a/${p.activityId}/uploads/${u.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {u.originalFilename}
                </Link>
                <span className="ml-2 text-slate-400">{u.parseStatus}</span>
              </li>
            ))}
            {activity.uploads.length === 0 && (
              <p className="text-slate-500">No uploads yet</p>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

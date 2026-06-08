"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ClearDataButton } from "@/components/dashboard/clear-data-button";

export type ManageUploadRow = {
  id: string;
  originalFilename: string;
  sheetName: string | null;
  parseStatus: string;
  kind: string;
  uploadedAt: string;
  activityName: string | null;
  stagingCount: number;
};

export type ManageActivityRow = {
  id: string;
  name: string;
  categoryCode: string;
  categoryName: string;
  status: string;
  participantCount: number;
  uploadCount: number;
};

export function DataManagerPanel({
  hallSlug,
  hallName,
  canClearAll,
  uploads,
  activities,
}: {
  hallSlug: string;
  hallName: string;
  canClearAll: boolean;
  uploads: ManageUploadRow[];
  activities: ManageActivityRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function removeUpload(id: string, name: string) {
    if (!confirm(`Delete upload "${name}" and its parsed rows?`)) return;
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/h/${hallSlug}/uploads/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not delete upload");
      setBusyId(null);
      return;
    }
    setBusyId(null);
    router.refresh();
  }

  async function removeActivity(id: string, name: string) {
    if (
      !confirm(
        `Delete activity "${name}" and all its participants, points, and linked uploads?`,
      )
    ) {
      return;
    }
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/h/${hallSlug}/activities/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not delete activity");
      setBusyId(null);
      return;
    }
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <h3 className="mb-2 font-medium text-slate-900">Uploaded files</h3>
        <p className="mb-3 text-sm text-slate-500">
          Remove Excel uploads you no longer need. This deletes the file and any
          unparsed or staging rows.
        </p>
        {uploads.length === 0 ? (
          <p className="text-sm text-slate-500">No uploads</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border">
            {uploads.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{u.originalFilename}</p>
                  <p className="text-slate-500">
                    {u.kind}
                    {u.sheetName ? ` · sheet: ${u.sheetName}` : ""}
                    {u.activityName ? ` · ${u.activityName}` : ""}
                    {" · "}
                    {u.parseStatus} · {u.stagingCount} staging rows
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  disabled={busyId === u.id}
                  onClick={() => removeUpload(u.id, u.originalFilename)}
                >
                  {busyId === u.id ? "Removing..." : "Remove"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-medium text-slate-900">Activities</h3>
        <p className="mb-3 text-sm text-slate-500">
          Remove activities (events, sports, floor rep terms, HSO) you do not
          need. This deletes participants, points, and linked uploads.
        </p>
        {activities.length === 0 ? (
          <p className="text-sm text-slate-500">No activities</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border">
            {activities.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-slate-500">
                    {a.categoryName} · {a.status} · {a.participantCount}{" "}
                    participants · {a.uploadCount} uploads
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  disabled={busyId === a.id}
                  onClick={() => removeActivity(a.id, a.name)}
                >
                  {busyId === a.id ? "Removing..." : "Remove"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canClearAll && (
        <div className="rounded-lg border border-red-100 bg-red-50/50 p-4">
          <h3 className="mb-1 font-medium text-red-900">Clear entire hall</h3>
          <p className="mb-3 text-sm text-red-800">
            Remove all residents, activities, uploads, and points at once.
          </p>
          <ClearDataButton hallSlug={hallSlug} hallName={hallName} />
        </div>
      )}
    </div>
  );
}

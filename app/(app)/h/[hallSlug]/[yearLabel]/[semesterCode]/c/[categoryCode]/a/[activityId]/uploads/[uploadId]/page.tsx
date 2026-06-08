"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StagingRow {
  id: string;
  rawName?: string;
  rawSid?: string;
  rawRoom?: string;
  roleCode: string;
  basePoints: number;
  extraPoints: number;
  computedPoints: number;
  isApplied: boolean;
}

interface UploadDetail {
  id: string;
  originalFilename: string;
  parseStatus: string;
  parseLogJson?: {
    matched?: number;
    warnings?: string[];
    errors?: string[];
    applySummary?: { created?: number; duplicatesUpdated?: number };
  };
  staging: StagingRow[];
}

export default function UploadReviewPage() {
  const params = useParams<{ hallSlug: string; uploadId: string }>();
  const [upload, setUpload] = useState<UploadDetail | null>(null);
  const [applying, setApplying] = useState(false);

  async function load() {
    const res = await fetch(
      `/api/h/${params.hallSlug}/uploads/${params.uploadId}`,
    );
    setUpload(await res.json());
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [params.hallSlug, params.uploadId]);

  async function apply() {
    setApplying(true);
    await fetch(
      `/api/h/${params.hallSlug}/uploads/${params.uploadId}/apply`,
      { method: "POST" },
    );
    setApplying(false);
    load();
  }

  async function removeStagingRow(id: string) {
    if (!confirm("Remove this row from the import preview?")) return;
    await fetch(
      `/api/h/${params.hallSlug}/uploads/${params.uploadId}/staging?id=${id}`,
      { method: "DELETE" },
    );
    load();
  }

  async function updateStagingRow(
    id: string,
    field: "computedPoints" | "basePoints" | "rawName" | "rawSid",
    value: string,
  ) {
    const row = upload?.staging.find((s) => s.id === id);
    if (!row) return;
    await fetch(
      `/api/h/${params.hallSlug}/uploads/${params.uploadId}/staging`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          rawName: field === "rawName" ? value : row.rawName,
          rawSid: field === "rawSid" ? value : row.rawSid,
          basePoints:
            field === "basePoints" ? Number(value) : row.basePoints,
          computedPoints:
            field === "computedPoints" ? Number(value) : row.computedPoints,
        }),
      },
    );
    load();
  }

  if (!upload) return <p>Loading...</p>;

  const canApply =
    upload.parseStatus === "PARSED" || upload.parseStatus === "PARTIAL";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{upload.originalFilename}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Status: {upload.parseStatus}</p>
          <p>Rows to apply: {upload.staging.length}</p>
          {upload.parseLogJson?.warnings?.map((w, i) => (
            <p key={i} className="text-amber-600">
              {w}
            </p>
          ))}
          {upload.parseLogJson?.errors?.map((e, i) => (
            <p key={i} className="text-red-600">
              {e}
            </p>
          ))}
          {upload.parseLogJson?.applySummary && (
            <p className="text-green-700">
              Last apply: {upload.parseLogJson.applySummary.created ?? 0}{" "}
              created,{" "}
              {upload.parseLogJson.applySummary.duplicatesUpdated ?? 0} updated
            </p>
          )}
          <p className="text-slate-500">
            Remove unwanted rows or edit points before applying. Applied rows
            can still be edited on the Participants tab.
          </p>
          {canApply && (
            <Button onClick={apply} disabled={applying || upload.staging.length === 0}>
              {applying ? "Applying..." : "Apply to activity"}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">SID</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Points</th>
              <th className="px-3 py-2 text-left">Applied</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {upload.staging.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">
                  {s.isApplied ? (
                    s.rawName
                  ) : (
                    <Input
                      className="h-8 min-w-[140px]"
                      defaultValue={s.rawName ?? ""}
                      onBlur={(e) =>
                        updateStagingRow(s.id, "rawName", e.target.value)
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {s.isApplied ? (
                    s.rawSid
                  ) : (
                    <Input
                      className="h-8 w-28"
                      defaultValue={s.rawSid ?? ""}
                      onBlur={(e) =>
                        updateStagingRow(s.id, "rawSid", e.target.value)
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-2">{s.roleCode}</td>
                <td className="px-3 py-2">
                  {s.isApplied ? (
                    s.computedPoints
                  ) : (
                    <Input
                      type="number"
                      step="0.5"
                      className="h-8 w-20"
                      defaultValue={s.computedPoints}
                      onBlur={(e) =>
                        updateStagingRow(s.id, "computedPoints", e.target.value)
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-2">{s.isApplied ? "Yes" : "No"}</td>
                <td className="px-3 py-2">
                  {!s.isApplied && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeStagingRow(s.id)}
                    >
                      Remove
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {upload.staging.length === 0 && (
          <p className="p-4 text-sm text-slate-500">No staging rows</p>
        )}
      </div>
    </div>
  );
}

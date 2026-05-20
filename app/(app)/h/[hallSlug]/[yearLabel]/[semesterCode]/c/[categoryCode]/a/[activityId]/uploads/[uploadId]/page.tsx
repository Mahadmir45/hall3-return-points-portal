"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StagingRow {
  id: string;
  rawName?: string;
  rawSid?: string;
  rawRoom?: string;
  roleCode: string;
  basePoints: number;
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

  if (!upload) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{upload.originalFilename}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Status: {upload.parseStatus}</p>
          <p>Matched: {upload.parseLogJson?.matched ?? 0}</p>
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
              Last apply: {upload.parseLogJson.applySummary.created ?? 0} created,{" "}
              {upload.parseLogJson.applySummary.duplicatesUpdated ?? 0} updated
            </p>
          )}
          {(upload.parseStatus === "PARSED" ||
            upload.parseStatus === "PARTIAL") && (
            <Button onClick={apply} disabled={applying}>
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
            </tr>
          </thead>
          <tbody>
            {upload.staging.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">{s.rawName}</td>
                <td className="px-3 py-2">{s.rawSid}</td>
                <td className="px-3 py-2">{s.roleCode}</td>
                <td className="px-3 py-2">{s.computedPoints}</td>
                <td className="px-3 py-2">{s.isApplied ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

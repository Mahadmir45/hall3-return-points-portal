"use client";

import { FileUploader } from "@/components/upload/file-uploader";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Asset {
  id: string;
  originalFilename: string;
  kind: string;
  downloadUrl: string;
}

export default function ActivityFilesPage() {
  const params = useParams<{ hallSlug: string; activityId: string }>();
  const [assets, setAssets] = useState<Asset[]>([]);

  async function load() {
    const res = await fetch(
      `/api/h/${params.hallSlug}/activities/${params.activityId}/assets`,
    );
    setAssets(await res.json());
  }

  useEffect(() => {
    load();
  }, [params.hallSlug, params.activityId]);

  async function onImageUploaded(storageKey: string, filename: string) {
    await fetch(
      `/api/h/${params.hallSlug}/activities/${params.activityId}/assets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageKey,
          originalFilename: filename,
          kind: "IMAGE",
        }),
      },
    );
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 font-medium">Images folder</h3>
        <FileUploader
          hallSlug={params.hallSlug}
          kind="IMAGE"
          activityId={params.activityId}
          accept="image/*"
          onComplete={async () => load()}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((a) => (
          <a
            key={a.id}
            href={a.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
          >
            <p className="font-medium">{a.originalFilename}</p>
            <p className="text-xs text-slate-500">{a.kind}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

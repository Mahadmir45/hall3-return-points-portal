"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function FileUploader({
  hallSlug,
  kind,
  semesterId,
  activityId,
  onComplete,
  redirectAfterUpload,
  accept = ".xlsx,.xls,.csv,image/*",
}: {
  hallSlug: string;
  kind?: string;
  semesterId?: string;
  activityId?: string;
  onComplete?: (uploadId: string) => void;
  /** If set, navigate here after upload (append /uploads/:id) */
  redirectAfterUpload?: string;
  accept?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    setLoading(true);
    setStatus("Getting upload URL...");

    const signRes = await fetch(`/api/h/${hallSlug}/upload/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        kind,
      }),
    });
    if (!signRes.ok) throw new Error("Failed to sign upload");
    const { uploadUrl, storageKey, kind: detectedKind } = await signRes.json();

    setStatus("Uploading...");
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
      credentials: "include",
    });
    if (!putRes.ok) throw new Error("Upload failed");

    setStatus("Registering...");
    const regRes = await fetch(`/api/h/${hallSlug}/upload/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storageKey,
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        kind: kind ?? detectedKind,
        semesterId,
        activityId,
      }),
    });
    if (!regRes.ok) throw new Error("Register failed");
    const upload = await regRes.json();

    setStatus(
      upload.parseStatus === "PARSED" || upload.parseStatus === "PARTIAL"
        ? "Parsed — review below"
        : upload.parseStatus === "FAILED"
          ? "Parse failed — check review page"
          : "Processing complete",
    );
    setLoading(false);
    onComplete?.(upload.id);

    if (redirectAfterUpload && upload.id) {
      router.push(`${redirectAfterUpload}/uploads/${upload.id}`);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file).catch((err) => setStatus(String(err)));
        }}
      />
      <Button
        type="button"
        variant="outline"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
      >
        {loading ? "Uploading..." : "Upload file"}
      </Button>
      {status && <p className="text-sm text-slate-500">{status}</p>}
    </div>
  );
}

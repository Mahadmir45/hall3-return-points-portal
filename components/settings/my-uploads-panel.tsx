"use client";

import { useState } from "react";

type UploadRow = {
  id: string;
  originalFilename: string;
  parseStatus: string;
  uploadedAt: string;
  activityName: string | null;
  sharedWithUserIds: string[];
  isOwner: boolean;
};

type HallUser = {
  id: string;
  name: string | null;
  email: string;
};

export function MyUploadsPanel({
  hallSlug,
  initialUploads,
  hallUsers,
  currentUserId,
}: {
  hallSlug: string;
  initialUploads: UploadRow[];
  hallUsers: HallUser[];
  currentUserId: string;
}) {
  const [uploads, setUploads] = useState(initialUploads);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function saveShare(uploadId: string, sharedWithUserIds: string[]) {
    setSavingId(uploadId);
    setMessage("");
    try {
      const res = await fetch(
        `/api/h/${hallSlug}/settings/uploads/${uploadId}/share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sharedWithUserIds }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Could not update access.");
        return;
      }
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId ? { ...u, sharedWithUserIds } : u,
        ),
      );
      setMessage("File access updated.");
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setSavingId(null);
    }
  }

  function toggleShare(uploadId: string, userId: string, checked: boolean) {
    const upload = uploads.find((u) => u.id === uploadId);
    if (!upload) return;
    const next = checked
      ? [...upload.sharedWithUserIds, userId]
      : upload.sharedWithUserIds.filter((id) => id !== userId);
    void saveShare(uploadId, next);
  }

  if (uploads.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No files yet. Uploads you own or that are shared with you will appear
        here.
      </p>
    );
  }

  const shareableUsers = hallUsers.filter((u) => u.id !== currentUserId);

  return (
    <div className="space-y-4">
      {message && <p className="text-sm text-slate-600">{message}</p>}
      <ul className="divide-y divide-slate-100">
        {uploads.map((upload) => (
          <li key={upload.id} className="py-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">
                  {upload.originalFilename}
                </p>
                <p className="text-sm text-slate-500">
                  {upload.activityName ?? "Hall upload"} · {upload.parseStatus}{" "}
                  · {new Date(upload.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                {upload.isOwner ? "You uploaded this" : "Shared with you"}
              </span>
            </div>

            {upload.isOwner && shareableUsers.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Grant access to hall tutors
                </p>
                <div className="flex flex-wrap gap-3">
                  {shareableUsers.map((user) => {
                    const checked = upload.sharedWithUserIds.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        className="flex items-center gap-2 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={savingId === upload.id}
                          onChange={(e) =>
                            toggleShare(upload.id, user.id, e.target.checked)
                          }
                        />
                        {user.name ?? user.email}
                      </label>
                    );
                  })}
                </div>
                {savingId === upload.id && (
                  <p className="mt-2 text-xs text-slate-500">Saving...</p>
                )}
              </div>
            )}

            {upload.isOwner && shareableUsers.length === 0 && (
              <p className="text-sm text-slate-500">
                No other hall users to share with yet.
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

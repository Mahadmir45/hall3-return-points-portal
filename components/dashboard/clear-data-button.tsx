"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClearDataButton({
  hallSlug,
  hallName,
}: {
  hallSlug: string;
  hallName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClear() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/h/${hallSlug}/admin/clear-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPhrase: phrase }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to clear data");
        setLoading(false);
        return;
      }
      setOpen(false);
      setPhrase("");
      router.refresh();
    } catch {
      setError("Request failed");
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="border-red-200 text-red-700 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        Clear all hall data
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
      <div>
        <p className="font-medium text-red-900">Clear all data for {hallName}?</p>
        <p className="mt-1 text-sm text-red-800">
          This permanently removes residents, activities, participants, points,
          uploads, and audit logs for this hall. Users, halls, and empty category
          folders are kept.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-slug">
          Type <span className="font-mono font-semibold">{hallSlug}</span> to confirm
        </Label>
        <Input
          id="confirm-slug"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder={hallSlug}
          autoComplete="off"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          disabled={loading || phrase !== hallSlug}
          onClick={handleClear}
        >
          {loading ? "Clearing..." : "Yes, clear everything"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => {
            setOpen(false);
            setPhrase("");
            setError("");
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

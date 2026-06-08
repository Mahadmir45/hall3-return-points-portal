"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Participant {
  id: string;
  rawName?: string | null;
  rawSid?: string | null;
  rawRoom?: string | null;
  roleCode: string;
  basePoints: number;
  extraPoints: number;
  rating?: number | null;
  computedPoints: number;
  notes?: string | null;
  student?: { nameFull: string; sid: string } | null;
}

export function ParticipantsGrid({
  hallSlug,
  activityId,
  readOnly = false,
}: {
  hallSlug: string;
  activityId: string;
  readOnly?: boolean;
}) {
  const [rows, setRows] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch(
      `/api/h/${hallSlug}/activities/${activityId}/participants`,
    );
    setRows(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [hallSlug, activityId]);

  async function updateRow(
    id: string,
    patch: Partial<{
      basePoints: number;
      extraPoints: number;
      rating: number | null;
      computedPoints: number;
      roleCode: string;
      notes: string;
    }>,
  ) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setSavingId(id);
    await fetch(`/api/h/${hallSlug}/activities/${activityId}/participants`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        basePoints: patch.basePoints ?? row.basePoints,
        extraPoints: patch.extraPoints ?? row.extraPoints,
        rating: patch.rating !== undefined ? patch.rating : row.rating,
        computedPoints: patch.computedPoints ?? row.computedPoints,
        roleCode: patch.roleCode ?? row.roleCode,
        notes: patch.notes ?? row.notes ?? undefined,
      }),
    });
    await load();
    setSavingId(null);
  }

  async function removeRow(id: string) {
    if (!confirm("Remove this participant from the activity?")) return;
    setSavingId(id);
    await fetch(
      `/api/h/${hallSlug}/activities/${activityId}/participants?id=${id}`,
      { method: "DELETE" },
    );
    await load();
    setSavingId(null);
  }

  if (loading) return <p className="text-sm text-slate-500">Loading...</p>;

  return (
    <div className="space-y-2">
      {!readOnly && (
        <p className="text-sm text-slate-500">
          Edit points inline, then tab out to save. Changes appear in the Points
          tabulation immediately.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">SID</th>
              <th className="px-3 py-2 text-left">Room</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Base</th>
              <th className="px-3 py-2 text-left">Extra</th>
              <th className="px-3 py-2 text-left">Rating</th>
              <th className="px-3 py-2 text-left">Total</th>
              {!readOnly && <th className="px-3 py-2 text-left">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{r.student?.nameFull ?? r.rawName}</td>
                <td className="px-3 py-2">{r.student?.sid ?? r.rawSid ?? "—"}</td>
                <td className="px-3 py-2">{r.rawRoom ?? "—"}</td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    r.roleCode
                  ) : (
                    <Input
                      className="h-8 w-28"
                      defaultValue={r.roleCode}
                      onBlur={(e) =>
                        updateRow(r.id, { roleCode: e.target.value })
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    r.basePoints
                  ) : (
                    <Input
                      type="number"
                      step="0.5"
                      className="h-8 w-20"
                      defaultValue={r.basePoints}
                      onBlur={(e) =>
                        updateRow(r.id, { basePoints: Number(e.target.value) })
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    r.extraPoints
                  ) : (
                    <Input
                      type="number"
                      step="0.5"
                      className="h-8 w-20"
                      defaultValue={r.extraPoints}
                      onBlur={(e) =>
                        updateRow(r.id, { extraPoints: Number(e.target.value) })
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  {readOnly ? (
                    (r.rating ?? "—")
                  ) : (
                    <Input
                      type="number"
                      step="0.5"
                      className="h-8 w-20"
                      defaultValue={r.rating ?? ""}
                      onBlur={(e) =>
                        updateRow(r.id, {
                          rating: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  )}
                </td>
                <td className="px-3 py-2 font-medium">
                  {readOnly ? (
                    r.computedPoints
                  ) : (
                    <Input
                      type="number"
                      step="0.5"
                      className="h-8 w-20 font-medium"
                      defaultValue={r.computedPoints}
                      onBlur={(e) =>
                        updateRow(r.id, {
                          computedPoints: Number(e.target.value),
                        })
                      }
                    />
                  )}
                </td>
                {!readOnly && (
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={savingId === r.id}
                      onClick={() => removeRow(r.id)}
                    >
                      Remove
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-4 text-sm text-slate-500">No participants yet</p>
        )}
      </div>
    </div>
  );
}

export function AddParticipantForm({
  hallSlug,
  activityId,
  onAdded,
  readOnly = false,
}: {
  hallSlug: string;
  activityId: string;
  onAdded: () => void;
  readOnly?: boolean;
}) {
  const [sid, setSid] = useState("");
  const [roleCode, setRoleCode] = useState("PARTICIPANT");
  const [basePoints, setBasePoints] = useState(2);

  if (readOnly) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const studentsRes = await fetch(
      `/api/h/${hallSlug}/students?q=${encodeURIComponent(sid)}`,
    );
    const students = await studentsRes.json();
    const match = students.find((s: { sid: string }) => s.sid === sid);

    await fetch(`/api/h/${hallSlug}/activities/${activityId}/participants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: match?.id,
        rawSid: sid,
        rawName: match?.nameFull,
        rawRoom: match?.roomCode,
        roleCode,
        basePoints,
      }),
    });
    setSid("");
    onAdded();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="text-xs text-slate-500">SID</label>
        <Input value={sid} onChange={(e) => setSid(e.target.value)} required />
      </div>
      <div>
        <label className="text-xs text-slate-500">Role</label>
        <Input
          value={roleCode}
          onChange={(e) => setRoleCode(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs text-slate-500">Points</label>
        <Input
          type="number"
          value={basePoints}
          onChange={(e) => setBasePoints(Number(e.target.value))}
        />
      </div>
      <Button type="submit" size="sm">
        Add
      </Button>
    </form>
  );
}

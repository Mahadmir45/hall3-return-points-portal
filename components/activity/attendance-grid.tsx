"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface Session {
  id: string;
  label: string;
}

interface Participant {
  id: string;
  rawName?: string | null;
  student?: { nameFull: string } | null;
  attendance: { sessionId: string; attended: boolean }[];
}

export function AttendanceGrid({
  hallSlug,
  activityId,
}: {
  hallSlug: string;
  activityId: string;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  async function load() {
    const res = await fetch(
      `/api/h/${hallSlug}/activities/${activityId}/attendance`,
    );
    const data = await res.json();
    setSessions(data.sessions);
    setParticipants(data.participants);
  }

  useEffect(() => {
    load();
  }, [hallSlug, activityId]);

  async function toggle(
    sessionId: string,
    participantId: string,
    attended: boolean,
  ) {
    await fetch(`/api/h/${hallSlug}/activities/${activityId}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, participantId, attended }),
    });
    load();
  }

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No sessions yet. Upload an ICFD report or add sessions manually.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left">Name</th>
            {sessions.map((s) => (
              <th key={s.id} className="px-2 py-2 text-left text-xs">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="px-3 py-2">
                {p.student?.nameFull ?? p.rawName}
              </td>
              {sessions.map((s) => {
                const att = p.attendance.find((a) => a.sessionId === s.id);
                const attended = att?.attended ?? false;
                return (
                  <td key={s.id} className="px-2 py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={attended ? "default" : "outline"}
                      onClick={() => toggle(s.id, p.id, !attended)}
                    >
                      {attended ? "Y" : "N"}
                    </Button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

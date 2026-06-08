"use client";

import { useState } from "react";
import {
  ParticipantsGrid,
  AddParticipantForm,
} from "@/components/activity/participants-grid";

export function ParticipantsPageClient({
  hallSlug,
  activityId,
  readOnly,
}: {
  hallSlug: string;
  activityId: string;
  readOnly: boolean;
}) {
  const [key, setKey] = useState(0);

  return (
    <div className="space-y-4">
      {readOnly && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This activity is finalized — participants are read-only.
        </p>
      )}
      <AddParticipantForm
        hallSlug={hallSlug}
        activityId={activityId}
        readOnly={readOnly}
        onAdded={() => setKey((k) => k + 1)}
      />
      <ParticipantsGrid
        key={key}
        hallSlug={hallSlug}
        activityId={activityId}
        readOnly={readOnly}
      />
    </div>
  );
}

"use client";

import {
  ParticipantsGrid,
  AddParticipantForm,
} from "@/components/activity/participants-grid";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function ActivityParticipantsPage() {
  const params = useParams<{ hallSlug: string; activityId: string }>();
  const [key, setKey] = useState(0);

  return (
    <div className="space-y-4">
      <AddParticipantForm
        hallSlug={params.hallSlug}
        activityId={params.activityId}
        onAdded={() => setKey((k) => k + 1)}
      />
      <ParticipantsGrid
        key={key}
        hallSlug={params.hallSlug}
        activityId={params.activityId}
      />
    </div>
  );
}

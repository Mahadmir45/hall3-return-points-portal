"use client";

import { AttendanceGrid } from "@/components/activity/attendance-grid";
import { useParams } from "next/navigation";

export default function ActivityAttendancePage() {
  const params = useParams<{ hallSlug: string; activityId: string }>();

  return (
    <AttendanceGrid
      hallSlug={params.hallSlug}
      activityId={params.activityId}
    />
  );
}

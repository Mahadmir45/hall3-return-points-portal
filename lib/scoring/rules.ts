export interface ScoringRuleJson {
  type?: "event" | "icfd" | "floor_rep" | "hso" | "default";
  formula?: string;
  participantDefault?: number;
  awards?: { gold?: number; silver?: number; bronze?: number };
}

export function computePoints(params: {
  basePoints: number;
  extraPoints: number;
  rating?: number | null;
  trainingCount?: number;
  rule?: ScoringRuleJson | null;
}): number {
  const { basePoints, extraPoints, rating, trainingCount = 0, rule } = params;

  if (rule?.formula === "participation + extra + trainingCount") {
    return basePoints + extraPoints + trainingCount;
  }

  if (rule?.type === "event" && rating != null && rating > 0) {
    return rating;
  }

  if (basePoints + extraPoints > 0) {
    return basePoints + extraPoints;
  }

  if (rating != null && rating > 0) return rating;

  return rule?.participantDefault ?? basePoints;
}

export function countAttendedSessions(
  attendance: { attended: boolean }[],
): number {
  return attendance.filter((a) => a.attended).length;
}

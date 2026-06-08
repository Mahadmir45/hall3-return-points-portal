import { prisma } from "@/lib/db";
import { computePoints, countAttendedSessions } from "@/lib/scoring/rules";
import type { ScoringRuleJson } from "@/lib/scoring/rules";
import type { ActivityType } from "@prisma/client";

function ruleForCategory(
  rules: { scope: string; refId: string | null; ruleJson: unknown }[],
  categoryId: string,
): ScoringRuleJson | null {
  const scoped =
    rules.find((r) => r.scope === "CATEGORY" && r.refId === categoryId) ??
    rules.find((r) => r.scope === "ACTIVITY" && r.refId === categoryId) ??
    rules.find((r) => r.scope === "HALL");
  return (scoped?.ruleJson as ScoringRuleJson) ?? null;
}

export function computeParticipantPointsFromRules(params: {
  activityType: ActivityType;
  categoryId: string;
  basePoints: number;
  extraPoints: number;
  rating?: number | null;
  attendance?: { attended: boolean }[];
  rules: { scope: string; refId: string | null; ruleJson: unknown }[];
}): number {
  const {
    activityType,
    categoryId,
    basePoints,
    extraPoints,
    rating,
    attendance = [],
    rules,
  } = params;

  const rule = ruleForCategory(rules, categoryId);
  const trainingCount = countAttendedSessions(attendance);

  if (activityType === "SPORT" || rule?.formula?.includes("trainingCount")) {
    return computePoints({
      basePoints,
      extraPoints,
      rating,
      trainingCount,
      rule: rule ?? { formula: "participation + extra + trainingCount" },
    });
  }

  return computePoints({
    basePoints,
    extraPoints,
    rating,
    trainingCount,
    rule,
  });
}

export async function recomputeParticipantPoints(
  participantId: string,
  overrides?: {
    basePoints?: number;
    extraPoints?: number;
    rating?: number | null;
  },
): Promise<number> {
  const participant = await prisma.activityParticipant.findUnique({
    where: { id: participantId },
    include: {
      activity: {
        include: {
          category: {
            include: {
              semester: { include: { academicYear: true } },
            },
          },
        },
      },
      attendance: true,
    },
  });
  if (!participant) return 0;

  const hallId = participant.activity.category.semester.academicYear.hallId;
  const rules = await prisma.scoringRule.findMany({ where: { hallId } });

  const basePoints = overrides?.basePoints ?? participant.basePoints;
  const extraPoints = overrides?.extraPoints ?? participant.extraPoints;
  const rating =
    overrides?.rating !== undefined ? overrides.rating : participant.rating;

  return computeParticipantPointsFromRules({
    activityType: participant.activity.type,
    categoryId: participant.activity.categoryId,
    basePoints,
    extraPoints,
    rating,
    attendance: participant.attendance,
    rules,
  });
}

export async function recomputeAndSaveParticipantPoints(
  participantId: string,
  overrides?: {
    basePoints?: number;
    extraPoints?: number;
    rating?: number | null;
  },
): Promise<number> {
  const computedPoints = await recomputeParticipantPoints(participantId, overrides);
  await prisma.activityParticipant.update({
    where: { id: participantId },
    data: { computedPoints },
  });
  return computedPoints;
}

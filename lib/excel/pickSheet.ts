import { loadWorksheetRows } from "./helpers";
import type { UploadKind } from "@prisma/client";

export interface SheetPickContext {
  activityName?: string | null;
  semesterCode?: string | null;
  filename?: string | null;
  preferredSheet?: string | null;
}

const SKIP_PATTERNS = [
  /^0\.\s*summary/i,
  /summary$/i,
  /^copy of/i,
  /template/i,
  /^all-advfin/i,
  /^icfd-sem/i,
];

function shouldSkipSheet(name: string, kind: UploadKind): boolean {
  const lower = name.toLowerCase();
  if (SKIP_PATTERNS.some((p) => p.test(name))) return true;
  if (kind !== "ROSTER" && /sem[a-z]-list/i.test(lower)) return true;
  if (kind === "ROSTER" && !/list/i.test(lower)) return true;
  return false;
}

function semHint(code?: string | null): string | null {
  if (!code) return null;
  const c = code.toUpperCase();
  if (c === "A") return "sem a";
  if (c === "B") return "sem b";
  return c.toLowerCase();
}

function normalizeSheetName(name: string): string {
  return name.toLowerCase().replace(/[\s._-]+/g, "");
}

function scoreSheet(
  name: string,
  kind: UploadKind,
  ctx: SheetPickContext,
): number {
  if (shouldSkipSheet(name, kind)) return -1000;

  const lower = name.toLowerCase();
  const normalized = normalizeSheetName(name);
  const activity = (ctx.activityName ?? "").toLowerCase();
  const activityNorm = normalizeSheetName(activity);
  const filename = (ctx.filename ?? "").toLowerCase();
  const sem = semHint(ctx.semesterCode);
  let score = 0;

  if (ctx.preferredSheet && name === ctx.preferredSheet) return 1000;

  switch (kind) {
    case "RLA_REPORT":
      if (/welcome|party|trivia|event/i.test(lower)) score += 10;
      if (activityNorm && normalized.includes(activityNorm.slice(0, 8)))
        score += 120;
      for (const token of activity.split(/\s+/)) {
        if (token.length > 3 && normalized.includes(normalizeSheetName(token)))
          score += 35;
      }
      if (/^\d+\./.test(name)) score += 15;
      break;
    case "ICFD_REPORT":
      if (/basketball|badminton|futsal|table tennis|tow|singcon|volleyball/i.test(lower))
        score += 50;
      if (activityNorm) {
        for (const token of activity.split(/\s+/)) {
          const t = normalizeSheetName(token);
          if (t.length > 3 && normalized.includes(t)) score += 40;
        }
      }
      if (/^\d+\.[a-z]/i.test(name)) score += 25;
      break;
    case "FLOOR_REP_SHEET":
      if (/floor rep/i.test(lower)) score += 60;
      if (sem && lower.includes(sem)) score += 80;
      if (/sem a/i.test(lower) && sem === "sem a") score += 40;
      if (/sem b/i.test(lower) && sem === "sem b") score += 40;
      break;
    case "HSO_SHEET":
      if (/^events-sem/i.test(lower)) score += 90;
      if (sem === "sem a" && /events-sema/i.test(lower.replace(/\s/g, "")))
        score += 60;
      if (sem === "sem b" && /events-semb/i.test(lower.replace(/\s/g, "")))
        score += 60;
      if (/performance|hso/i.test(lower)) score += 20;
      break;
    case "ROSTER":
      if (/sem[a-z]-list/i.test(lower)) score += 100;
      if (sem === "sem a" && /sema/i.test(lower)) score += 50;
      if (sem === "sem b" && /semb/i.test(lower)) score += 50;
      break;
    default:
      break;
  }

  if (filename && lower.includes(filename.replace(/\.xlsx?$/i, "").slice(0, 8)))
    score += 10;

  return score;
}

export async function pickWorksheet(
  buffer: Buffer,
  kind: UploadKind,
  ctx: SheetPickContext = {},
): Promise<{ sheetName: string; sheetNames: string[]; scores: Record<string, number> }> {
  const { sheetNames } = await loadWorksheetRows(buffer);
  if (ctx.preferredSheet && sheetNames.includes(ctx.preferredSheet)) {
    return {
      sheetName: ctx.preferredSheet,
      sheetNames,
      scores: { [ctx.preferredSheet]: 1000 },
    };
  }

  if (sheetNames.length === 1) {
    return { sheetName: sheetNames[0], sheetNames, scores: { [sheetNames[0]]: 1 } };
  }

  const scores: Record<string, number> = {};
  let best = sheetNames[0];
  let bestScore = -Infinity;

  for (const name of sheetNames) {
    const s = scoreSheet(name, kind, ctx);
    scores[name] = s;
    if (s > bestScore) {
      bestScore = s;
      best = name;
    }
  }

  return { sheetName: best, sheetNames, scores };
}

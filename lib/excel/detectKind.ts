import type { UploadKind } from "@prisma/client";

export function detectUploadKind(
  filename: string,
  sheetName?: string,
): UploadKind {
  const lower = `${filename} ${sheetName ?? ""}`.toLowerCase();

  if (lower.includes("sem") && lower.includes("list")) return "ROSTER";
  if (lower.includes("floor rep")) return "FLOOR_REP_SHEET";
  if (lower.includes("hso") || lower.includes("performance")) return "HSO_SHEET";
  if (
    lower.includes("icfd") ||
    lower.includes("basketball") ||
    lower.includes("badminton") ||
    lower.includes("futsal") ||
    lower.includes("table tennis") ||
    lower.includes("tow") ||
    lower.includes("singcon")
  ) {
    return "ICFD_REPORT";
  }
  if (lower.includes("event") || lower.includes("rla")) return "RLA_REPORT";

  return "OTHER";
}

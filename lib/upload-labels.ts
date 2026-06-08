const UPLOAD_LABELS: Record<string, string> = {
  EVENTS: "Upload RLA Report",
  ICFD: "Upload ICFD Report",
  FLOOR_REPS: "Upload Floor Rep Sheet",
  HSO: "Upload HSO Report / Work",
};

export function uploadCardTitle(categoryCode: string): string {
  return UPLOAD_LABELS[categoryCode] ?? "Upload file";
}

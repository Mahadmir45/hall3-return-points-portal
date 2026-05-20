import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSid(sid: string | number | null | undefined): string {
  if (sid == null || sid === "") return "";
  const digits = String(sid).replace(/\D/g, "");
  return digits;
}

export function slugifyYear(label: string): string {
  return label.replace(/\//g, "-");
}

export function parseYearSlug(slug: string): string {
  return slug.replace(/-/g, "/");
}

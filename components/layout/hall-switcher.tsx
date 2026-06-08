"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function HallSwitcher({ currentSlug }: { currentSlug: string }) {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const halls = session?.user?.halls ?? [];

  if (halls.length <= 1 && session?.user?.role !== "SUPER_ADMIN") {
    return null;
  }

  async function onChange(slug: string) {
    if (slug === currentSlug) return;
    setLoading(true);
    await update({ activeHallSlug: slug });
    router.push(`/h/${slug}`);
    setLoading(false);
  }

  if (session?.user?.role === "SUPER_ADMIN" && halls.length === 0) {
    return (
      <a
        href="/admin/halls"
        className="text-sm text-blue-600 hover:underline"
      >
        All halls
      </a>
    );
  }

  return (
    <select
      className="rounded border border-slate-200 bg-white px-2 py-1 text-sm"
      value={currentSlug}
      disabled={loading}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Switch hall"
    >
      {halls.map((h) => (
        <option key={h.slug} value={h.slug}>
          {h.name}
        </option>
      ))}
    </select>
  );
}

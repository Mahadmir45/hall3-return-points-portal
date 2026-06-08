import Link from "next/link";
import { cn } from "@/lib/utils";
import { canManageUsers } from "@/lib/auth";
import type { Role } from "@prisma/client";

const ITEMS = [
  { slug: "account", label: "Account" },
  { slug: "security", label: "Security" },
  { slug: "files", label: "My files" },
] as const;

export function SettingsNav({
  hallSlug,
  role,
  active,
}: {
  hallSlug: string;
  role: Role;
  active: (typeof ITEMS)[number]["slug"];
}) {
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((item) => (
        <Link
          key={item.slug}
          href={`/h/${hallSlug}/settings${item.slug === "account" ? "" : `#${item.slug}`}`}
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium",
            active === item.slug
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100",
          )}
        >
          {item.label}
        </Link>
      ))}
      {canManageUsers(role) && (
        <Link
          href={`/h/${hallSlug}/settings/hall`}
          className="mt-4 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Hall administration →
        </Link>
      )}
    </nav>
  );
}

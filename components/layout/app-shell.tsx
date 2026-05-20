import Link from "next/link";
import { cn } from "@/lib/utils";

export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span>/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-blue-600">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-900">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function AppShell({
  hallName,
  hallSlug,
  userName,
  children,
}: {
  hallName: string;
  hallSlug: string;
  userName?: string | null;
  children: React.ReactNode;
}) {
  const nav = [
    { href: `/h/${hallSlug}`, label: "Dashboard" },
    { href: `/h/${hallSlug}/roster`, label: "Roster" },
    { href: `/h/${hallSlug}/points`, label: "Points" },
    { href: `/h/${hallSlug}/audit`, label: "Audit" },
    { href: `/h/${hallSlug}/settings/hall`, label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Return Points Portal
            </p>
            <h1 className="text-xl font-bold text-slate-900">{hallName}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{userName}</span>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm text-slate-500 hover:text-slate-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 px-4 pb-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}

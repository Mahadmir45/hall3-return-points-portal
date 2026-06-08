import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

export interface AccessibleHall {
  id: string;
  slug: string;
  name: string;
  code: string;
}

export async function getAccessibleHallsForUser(
  userId: string,
  role: Role,
): Promise<AccessibleHall[]> {
  if (role === "SUPER_ADMIN") {
    return prisma.hall.findMany({
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, code: true },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      hall: { select: { id: true, slug: true, name: true, code: true } },
      userHalls: {
        include: {
          hall: { select: { id: true, slug: true, name: true, code: true } },
        },
      },
    },
  });
  if (!user) return [];

  const bySlug = new Map<string, AccessibleHall>();
  if (user.hall) bySlug.set(user.hall.slug, user.hall);
  for (const uh of user.userHalls) {
    bySlug.set(uh.hall.slug, uh.hall);
  }
  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function userCanAccessHall(
  userId: string,
  role: Role,
  hallSlug: string,
): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true;
  const halls = await getAccessibleHallsForUser(userId, role);
  return halls.some((h) => h.slug === hallSlug);
}

export async function resolveActiveHall(
  userId: string,
  role: Role,
  preferredSlug?: string | null,
): Promise<AccessibleHall | null> {
  const halls = await getAccessibleHallsForUser(userId, role);
  if (halls.length === 0) return null;
  if (preferredSlug) {
    return halls.find((h) => h.slug === preferredSlug) ?? halls[0];
  }
  return halls[0];
}

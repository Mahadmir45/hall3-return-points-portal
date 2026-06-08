import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  getAccessibleHallsForUser,
  userCanAccessHall,
  type AccessibleHall,
} from "@/lib/auth/halls";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      hallId?: string | null;
      hallSlug?: string | null;
      halls?: AccessibleHall[];
    };
  }

  interface User {
    role: Role;
    hallId?: string | null;
    hallSlug?: string | null;
    halls?: AccessibleHall[];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    hallId?: string | null;
    hallSlug?: string | null;
    halls?: AccessibleHall[];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email },
          include: { hall: true },
        });

        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(
          String(credentials.password),
          user.passwordHash,
        );
        if (!valid) return null;

        const halls = await getAccessibleHallsForUser(user.id, user.role);
        const active =
          halls.find((h) => h.id === user.hallId) ?? halls[0] ?? null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          hallId: active?.id ?? user.hallId,
          hallSlug: active?.slug ?? user.hall?.slug ?? null,
          halls,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.hallId = user.hallId;
        token.hallSlug = user.hallSlug;
        token.halls = user.halls ?? [];
      }

      if (trigger === "update" && session?.activeHallSlug) {
        const halls = token.halls ?? [];
        const next = halls.find((h) => h.slug === session.activeHallSlug);
        if (next || token.role === "SUPER_ADMIN") {
          if (next) {
            token.hallSlug = next.slug;
            token.hallId = next.id;
          } else if (token.role === "SUPER_ADMIN") {
            const hall = await prisma.hall.findUnique({
              where: { slug: String(session.activeHallSlug) },
              select: { id: true, slug: true, name: true, code: true },
            });
            if (hall) {
              token.hallSlug = hall.slug;
              token.hallId = hall.id;
            }
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.hallId = token.hallId;
        session.user.hallSlug = token.hallSlug;
        session.user.halls = token.halls ?? [];
      }
      return session;
    },
  },
});

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireHallAccess(hallSlug: string) {
  const session = await requireSession();
  const { role, id } = session.user;

  const allowed = await userCanAccessHall(id, role, hallSlug);
  if (!allowed) {
    throw new Error("Forbidden: hall access denied");
  }

  return session;
}

export function canEditRoster(role: Role) {
  return role === "MASTER" || role === "SUPER_ADMIN";
}

export function canFinalize(role: Role) {
  return role === "MASTER" || role === "SUPER_ADMIN";
}

export function canManageUsers(role: Role) {
  return role === "MASTER" || role === "SUPER_ADMIN";
}

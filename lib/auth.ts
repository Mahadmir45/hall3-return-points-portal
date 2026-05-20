import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
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
    };
  }

  interface User {
    role: Role;
    hallId?: string | null;
    hallSlug?: string | null;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    hallId?: string | null;
    hallSlug?: string | null;
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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          hallId: user.hallId,
          hallSlug: user.hall?.slug ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.hallId = user.hallId;
        token.hallSlug = user.hallSlug;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.hallId = token.hallId;
        session.user.hallSlug = token.hallSlug;
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
  const { role, hallSlug: userHallSlug } = session.user;

  if (role === "SUPER_ADMIN") return session;

  if (userHallSlug !== hallSlug) {
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

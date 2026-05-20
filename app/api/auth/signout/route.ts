import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST() {
  const { signOut } = await import("@/lib/auth");
  await signOut({ redirect: false });
  return NextResponse.redirect(new URL("/signin", process.env.AUTH_URL ?? "http://localhost:3000"));
}

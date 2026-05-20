import { getObjectBuffer } from "@/lib/storage";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const buffer = await getObjectBuffer(key);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/octet-stream" },
  });
}

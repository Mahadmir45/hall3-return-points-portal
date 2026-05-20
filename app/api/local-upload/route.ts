import { saveLocalFile } from "@/lib/storage";
import { NextResponse } from "next/server";

export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const buffer = Buffer.from(await req.arrayBuffer());
  await saveLocalFile(key, buffer);
  return new NextResponse(null, { status: 200 });
}

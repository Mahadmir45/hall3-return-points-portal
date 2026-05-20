import { auth, requireHallAccess } from "@/lib/auth";
import {
  buildStorageKey,
  getPresignedUploadUrl,
} from "@/lib/storage";
import { getHallBySlug } from "@/lib/db";
import { detectUploadKind } from "@/lib/excel/detectKind";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  kind: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string }> },
) {
  const { hallSlug } = await params;
  await requireHallAccess(hallSlug);
  const hall = await getHallBySlug(hallSlug);
  if (!hall) return NextResponse.json({ error: "Hall not found" }, { status: 404 });

  const body = schema.parse(await req.json());
  const kind = body.kind ?? detectUploadKind(body.filename);
  const storageKey = buildStorageKey(hallSlug, kind.toLowerCase(), body.filename);
  const uploadUrl = await getPresignedUploadUrl(storageKey, body.contentType);

  return NextResponse.json({ uploadUrl, storageKey, kind });
}

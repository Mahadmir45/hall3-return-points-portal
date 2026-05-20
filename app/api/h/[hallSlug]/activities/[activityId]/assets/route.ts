import { requireHallAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPresignedDownloadUrl } from "@/lib/storage";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hallSlug: string; activityId: string }> },
) {
  const { hallSlug, activityId } = await params;
  await requireHallAccess(hallSlug);

  const assets = await prisma.asset.findMany({
    where: { activityId },
    orderBy: { uploadedAt: "desc" },
  });

  const withUrls = await Promise.all(
    assets.map(async (a) => ({
      ...a,
      downloadUrl: await getPresignedDownloadUrl(a.storageKey),
    })),
  );

  return NextResponse.json(withUrls);
}

const createSchema = z.object({
  storageKey: z.string(),
  originalFilename: z.string(),
  mimeType: z.string().optional(),
  kind: z.enum(["IMAGE", "DOC", "OTHER"]).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string; activityId: string }> },
) {
  const { hallSlug, activityId } = await params;
  const session = await requireHallAccess(hallSlug);

  const body = createSchema.parse(await req.json());

  const asset = await prisma.asset.create({
    data: {
      activityId,
      storageKey: body.storageKey,
      originalFilename: body.originalFilename,
      mimeType: body.mimeType,
      kind: body.kind ?? "OTHER",
      uploadedById: session.user.id,
    },
  });

  return NextResponse.json(asset, { status: 201 });
}

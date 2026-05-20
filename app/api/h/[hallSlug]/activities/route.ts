import { requireHallAccess } from "@/lib/auth";
import { prisma, getHallBySlug } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  type: z.enum(["EVENT", "SPORT", "FLOOR_REP_TERM", "HSO_TERM", "OTHER"]),
  sortKey: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  externalCode: z.string().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string }> },
) {
  const { hallSlug } = await params;
  await requireHallAccess(hallSlug);

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");

  const activities = await prisma.activity.findMany({
    where: categoryId ? { categoryId } : undefined,
    include: {
      category: { include: { semester: { include: { academicYear: true } } } },
      _count: { select: { participants: true } },
    },
    orderBy: [{ sortKey: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(activities);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string }> },
) {
  const { hallSlug } = await params;
  const session = await requireHallAccess(hallSlug);
  const hall = await getHallBySlug(hallSlug);
  if (!hall) return NextResponse.json({ error: "Hall not found" }, { status: 404 });

  const body = createSchema.parse(await req.json());

  const activity = await prisma.activity.create({
    data: {
      categoryId: body.categoryId,
      name: body.name,
      type: body.type,
      sortKey: body.sortKey ?? "00",
      description: body.description,
      date: body.date ? new Date(body.date) : undefined,
      externalCode: body.externalCode,
      createdById: session.user.id,
      status: "DRAFT",
    },
  });

  return NextResponse.json(activity, { status: 201 });
}

import { requireHallAccess } from "@/lib/auth";
import { prisma, getHallBySlug } from "@/lib/db";
import { parseYearSlug } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string }> },
) {
  const { hallSlug } = await params;
  await requireHallAccess(hallSlug);
  const hall = await getHallBySlug(hallSlug);
  if (!hall) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const yearLabel = searchParams.get("yearLabel");
  const semesterCode = searchParams.get("semesterCode");
  const categoryCode = searchParams.get("categoryCode");

  if (!yearLabel || !semesterCode || !categoryCode) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const category = await prisma.category.findFirst({
    where: {
      code: categoryCode as never,
      semester: {
        code: semesterCode,
        academicYear: {
          hallId: hall.id,
          label: parseYearSlug(yearLabel),
        },
      },
    },
  });

  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  return NextResponse.json(category);
}

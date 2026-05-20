import { requireHallAccess } from "@/lib/auth";
import { getHallBySlug } from "@/lib/db";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ hallSlug: string }> },
) {
  const { hallSlug } = await params;
  await requireHallAccess(hallSlug);
  const hall = await getHallBySlug(hallSlug);
  if (!hall) return NextResponse.json({ error: "Hall not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const semesterId = searchParams.get("semesterId");
  if (!semesterId) {
    return NextResponse.json({ error: "semesterId required" }, { status: 400 });
  }

  const pointsRes = await import("@/app/api/h/[hallSlug]/points/route").then(
    (m) =>
      m.GET(req, { params: Promise.resolve({ hallSlug }) }),
  );
  const { totals, categories } = await pointsRes.json();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("0. Summary");

  sheet.addRow(["Hall", hall.name]);
  sheet.addRow([]);
  sheet.addRow([
    "SID",
    "Name",
    "Room",
    ...categories.map((c: { name: string }) => c.name),
    "Grand Total",
  ]);

  for (const row of totals) {
    sheet.addRow([
      row.sid,
      row.nameFull,
      row.roomCode,
      ...categories.map((c: { code: string }) => row.byCategory[c.code] ?? 0),
      row.grandTotal,
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${hallSlug}-points-summary.xlsx"`,
    },
  });
}

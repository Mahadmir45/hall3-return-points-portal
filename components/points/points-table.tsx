"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

interface TotalRow {
  studentId: string;
  sid: string;
  nameFull: string;
  roomCode: string;
  byCategory: Record<string, number>;
  grandTotal: number;
}

interface Category {
  code: string;
  name: string;
}

export function PointsPageClient({
  semesterId,
  canFinalize,
}: {
  semesterId: string;
  canFinalize: boolean;
}) {
  const params = useParams<{ hallSlug: string }>();
  const [totals, setTotals] = useState<TotalRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch(
      `/api/h/${params.hallSlug}/points?semesterId=${semesterId}`,
    )
      .then((r) => r.json())
      .then((data) => {
        setTotals(data.totals ?? []);
        setCategories(data.categories ?? []);
      });
  }, [params.hallSlug, semesterId]);

  async function exportXlsx() {
    window.location.href = `/api/h/${params.hallSlug}/points/export?semesterId=${semesterId}`;
  }

  async function finalize() {
    if (!confirm("Finalize semester? Activities will become read-only.")) return;
    await fetch(`/api/h/${params.hallSlug}/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ semesterId }),
    });
    alert("Semester finalized");
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" onClick={exportXlsx}>
          Export to Excel
        </Button>
        {canFinalize && (
          <Button variant="destructive" onClick={finalize}>
            Finalize semester
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">SID</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Room</th>
              {categories.map((c) => (
                <th key={c.code} className="px-3 py-2 text-left">
                  {c.name}
                </th>
              ))}
              <th className="px-3 py-2 text-left">Total</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((row) => (
              <tr key={row.studentId} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <a
                    href={`/h/${params.hallSlug}/points/${row.studentId}?semesterId=${semesterId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {row.sid}
                  </a>
                </td>
                <td className="px-3 py-2">{row.nameFull}</td>
                <td className="px-3 py-2">{row.roomCode}</td>
                {categories.map((c) => (
                  <td key={c.code} className="px-3 py-2">
                    {row.byCategory[c.code]?.toFixed(1) ?? "0"}
                  </td>
                ))}
                <td className="px-3 py-2 font-medium">
                  {row.grandTotal.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

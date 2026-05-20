"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewActivityPage({
  params,
}: {
  params: Promise<{
    hallSlug: string;
    yearLabel: string;
    semesterCode: string;
    categoryCode: string;
  }>;
}) {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<Awaited<
    typeof params
  > | null>(null);
  const [name, setName] = useState("");
  const [sortKey, setSortKey] = useState("");
  const [type, setType] = useState("EVENT");
  const [date, setDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(false);

  if (!resolvedParams) {
    params.then(async (p) => {
      setResolvedParams(p);
      const res = await fetch(
        `/api/h/${p.hallSlug}/activities?categoryId=placeholder`,
      );
      void res;
      const catRes = await fetch(
        `/api/h/${p.hallSlug}/internal/category?yearLabel=${p.yearLabel}&semesterCode=${p.semesterCode}&categoryCode=${p.categoryCode}`,
      ).catch(() => null);
      if (catRes?.ok) {
        const cat = await catRes.json();
        setCategoryId(cat.id);
        if (p.categoryCode === "ICFD") setType("SPORT");
        if (p.categoryCode === "FLOOR_REPS") setType("FLOOR_REP_TERM");
        if (p.categoryCode === "HSO") setType("HSO_TERM");
      }
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvedParams || !categoryId) return;
    setLoading(true);

    const res = await fetch(
      `/api/h/${resolvedParams.hallSlug}/activities`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          name,
          type,
          sortKey: sortKey || undefined,
          date: date || undefined,
        }),
      },
    );

    setLoading(false);
    if (res.ok) {
      const activity = await res.json();
      router.push(
        `/h/${resolvedParams.hallSlug}/${resolvedParams.yearLabel}/${resolvedParams.semesterCode}/c/${resolvedParams.categoryCode}/a/${activity.id}`,
      );
    }
  }

  return (
    <div className="mx-auto max-w-lg p-8">
      <Card>
        <CardHeader>
          <CardTitle>Create activity</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Sort key (e.g. 01)</Label>
              <Input value={sortKey} onChange={(e) => setSortKey(e.target.value)} />
            </div>
            <div>
              <Label>Type</Label>
              <Input value={type} onChange={(e) => setType(e.target.value)} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading || !categoryId}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

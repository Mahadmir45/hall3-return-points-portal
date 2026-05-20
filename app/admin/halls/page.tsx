import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminHallsPage() {
  const session = await auth();
  const halls = await prisma.hall.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin — Halls</h1>
          <span className="text-sm text-slate-600">{session?.user?.email}</span>
        </div>
        <div className="grid gap-4">
          {halls.map((hall) => (
            <Card key={hall.id}>
              <CardHeader>
                <CardTitle>{hall.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/h/${hall.slug}`}
                  className="text-blue-600 hover:underline"
                >
                  Open portal →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
        <Link href="/admin/users" className="text-blue-600 hover:underline">
          Manage users →
        </Link>
      </div>
    </div>
  );
}

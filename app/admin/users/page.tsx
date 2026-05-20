import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminUsersPage() {
  const session = await auth();
  const users = await prisma.user.findMany({
    include: { hall: true },
    orderBy: { email: "asc" },
  });

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin — Users</h1>
          <Link href="/admin/halls" className="text-blue-600 hover:underline">
            ← Halls
          </Link>
        </div>
        <p className="text-sm text-slate-600">
          Signed in as {session?.user?.email}
        </p>
        <div className="grid gap-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardHeader className="py-3">
                <CardTitle className="text-base">{u.email}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0 text-sm text-slate-600">
                {u.role} · {u.hall?.name ?? "No hall"} · {u.name}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

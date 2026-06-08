"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function SelectHallForm() {
  const { data: session, update, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const halls = session?.user?.halls ?? [];

  async function chooseHall(slug: string) {
    setLoadingSlug(slug);
    await update({ activeHallSlug: slug });
    const dest =
      callbackUrl && callbackUrl.startsWith(`/h/${slug}`)
        ? callbackUrl
        : `/h/${slug}`;
    router.push(dest);
  }

  useEffect(() => {
    if (status !== "authenticated" || halls.length !== 1 || loadingSlug) return;
    void chooseHall(halls[0].slug);
  }, [status, halls, loadingSlug]);

  if (status === "loading") {
    return <p className="text-slate-600">Loading halls...</p>;
  }

  if (halls.length === 0) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>No hall access</CardTitle>
          <CardDescription>
            Your account is not linked to any hall. Contact your hall master or
            system administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (halls.length === 1) {
    return <p className="text-slate-600">Redirecting...</p>;
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Select hall</CardTitle>
        <CardDescription>
          Choose which hall you want to manage. You can switch halls anytime
          from the header.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {halls.map((hall) => (
          <Button
            key={hall.slug}
            variant="outline"
            className="h-auto w-full justify-start py-3"
            disabled={loadingSlug !== null}
            onClick={() => chooseHall(hall.slug)}
          >
            <div className="text-left">
              <p className="font-medium">{hall.name}</p>
              <p className="text-xs text-slate-500">{hall.code}</p>
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

export default function SelectHallPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Suspense fallback={<p>Loading...</p>}>
        <SelectHallForm />
      </Suspense>
    </div>
  );
}

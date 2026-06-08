import { auth } from "@/lib/auth";
import { getAccessibleHallsForUser } from "@/lib/auth/halls";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }

  if (session.user.role === "SUPER_ADMIN") {
    redirect("/admin/halls");
  }

  const halls = await getAccessibleHallsForUser(
    session.user.id,
    session.user.role,
  );

  if (halls.length === 0) {
    redirect("/select-hall");
  }

  if (halls.length > 1 && !session.user.hallSlug) {
    redirect("/select-hall");
  }

  const active =
    halls.find((h) => h.slug === session.user.hallSlug) ?? halls[0];
  redirect(`/h/${active.slug}`);
}

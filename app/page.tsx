import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }

  if (session.user.role === "SUPER_ADMIN") {
    redirect("/admin/halls");
  }

  if (session.user.hallSlug) {
    redirect(`/h/${session.user.hallSlug}`);
  }

  redirect("/signin");
}

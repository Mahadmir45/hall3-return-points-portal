import { prisma } from "@/lib/db";
import { clearHallData } from "@/lib/admin/clearHallData";

async function main() {
  const halls = await prisma.hall.findMany({ orderBy: { name: "asc" } });
  if (halls.length === 0) {
    console.log("No halls found.");
    return;
  }

  for (const hall of halls) {
    const summary = await clearHallData(hall.id);
    console.log(`Cleared ${hall.name} (${hall.slug}):`, summary);
  }

  console.log("Done. Users, halls, and empty category folders are unchanged.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { listItems } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PurgatoryClient from "./PurgatoryClient";

export const dynamic = "force-dynamic";

export default async function PurgatoryPage() {
  const user = await requireUser("/purgatory");
  const allItems = listItems(user.id);
  const purgatoryItems = allItems.filter((i) => i.status === "purgatory");

  return <PurgatoryClient initialItems={purgatoryItems} />;
}

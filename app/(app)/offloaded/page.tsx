import { listItems } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import OffloadedClient from "./OffloadedClient";

export const dynamic = "force-dynamic";

export default async function OffloadedPage() {
  const user = await requireUser("/offloaded");
  const allItems = listItems(user.id);
  const offloadedItems = allItems.filter((i) =>
    ["sold", "donated", "disposed", "closed"].includes(i.status)
  );

  return <OffloadedClient initialItems={offloadedItems} />;
}

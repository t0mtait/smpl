import { listDisposals, listItems } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import OffloadedClient from "./OffloadedClient";

export const dynamic = "force-dynamic";

export default async function OffloadedPage() {
  const user = await requireUser("/offloaded");
  const allItems = listItems(user.id);
  const offloadedItems = allItems.filter((i) =>
    ["sold", "donated", "disposed", "closed"].includes(i.status)
  );

  // Sale proceeds live on the disposal record, not on the item's
  // currentValue — the same source the dashboard totals use.
  const saleAmounts: Record<number, number> = {};
  for (const d of listDisposals(user.id)) {
    if (d.disposition === "sold" && d.amount !== null) {
      saleAmounts[d.itemId] = (saleAmounts[d.itemId] ?? 0) + d.amount;
    }
  }

  return <OffloadedClient initialItems={offloadedItems} saleAmounts={saleAmounts} />;
}

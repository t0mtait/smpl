import { requireUser } from "@/lib/auth";
import { listItems } from "@/lib/db";
import { scoreAll } from "@/lib/scoring";
import AdvisorClient from "./AdvisorClient";

export const dynamic = "force-dynamic";

export default async function AdvisorPage() {
  const user = await requireUser("/advisor");
  const items = listItems(user.id);
  const scored = scoreAll(items);
  // Pick top 10 items
  const top10 = scored.slice(0, 10).map((s) => ({
    id: s.item.id,
    name: s.item.name,
    brand: s.item.brand,
    category: s.item.category,
    location: s.item.location,
    currentValue: s.item.currentValue,
    purchasePrice: s.item.purchasePrice,
    photoPath: s.item.photoPath,
    score: s.score,
    reasons: s.reasons,
    idleDays: s.idleDays,
  }));

  return <AdvisorClient initialSuggestions={top10} isPro={user.plan === "premium"} />;
}

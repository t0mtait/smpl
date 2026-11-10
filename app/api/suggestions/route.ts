import { NextResponse } from "next/server";
import { listItems } from "@/lib/db";
import { scoreAll } from "@/lib/scoring";
import { apiUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const url = new URL(req.url);
  const min = Number(url.searchParams.get("min") ?? 0);
  const all = scoreAll(listItems(user.id));
  const filtered = min > 0 ? all.filter((s) => s.score >= min) : all;
  return NextResponse.json({
    suggestions: filtered.map((s) => ({
      id: s.item.id,
      name: s.item.name,
      category: s.item.category,
      location: s.item.location,
      currentValue: s.item.currentValue,
      purchasePrice: s.item.purchasePrice,
      photoPath: s.item.photoPath,
      score: s.score,
      reasons: s.reasons,
      idleDays: s.idleDays,
    })),
  });
}

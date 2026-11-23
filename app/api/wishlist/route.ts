import { NextResponse } from "next/server";
import { createWishlistItem, listWishlist, parseWishlistPriority } from "@/lib/db";
import type { WishlistInput } from "@/lib/db";
import { apiUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function money(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.plan !== "premium") {
    return NextResponse.json({ items: [], error: "Wishlist is only available on the Pro plan." }, { status: 403 });
  }
  return NextResponse.json({ items: listWishlist(user.id) });
}

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.plan !== "premium") {
    return NextResponse.json({ error: "Wishlist is only available on the Pro plan." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Item name is required" }, { status: 400 });
  }

  const priority = body.priority !== undefined ? parseWishlistPriority(body.priority) : 50;

  const input: WishlistInput = {
    name,
    category: typeof body.category === "string" && body.category.trim() ? body.category.trim() : "misc",
    price: money(body.price),
    url: typeof body.url === "string" ? body.url.trim() : "",
    notes: typeof body.notes === "string" ? body.notes.trim() : "",
    priority,
  };

  const item = createWishlistItem(user.id, input);
  return NextResponse.json({ item }, { status: 201 });
}

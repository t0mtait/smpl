import { NextResponse } from "next/server";
import { convertWishlistItemToInventory, getWishlistItem } from "@/lib/db";
import { apiUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const existing = getWishlistItem(user.id, numId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  let purchasePrice: number | null | undefined = undefined;
  if (body.purchasePrice !== undefined) {
    if (body.purchasePrice === null || body.purchasePrice === "") {
      purchasePrice = null;
    } else {
      const p = Number(body.purchasePrice);
      purchasePrice = Number.isFinite(p) ? p : null;
    }
  }

  const item = convertWishlistItemToInventory(user.id, numId, purchasePrice);
  if (!item) return NextResponse.json({ error: "Failed to convert" }, { status: 500 });

  return NextResponse.json({ item }, { status: 200 });
}

import { NextResponse } from "next/server";
import { deleteWishlistItem, getWishlistItem, parseWishlistPriority, updateWishlistItem } from "@/lib/db";
import type { WishlistInput } from "@/lib/db";
import { apiUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function money(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const item = getWishlistItem(user.id, numId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ item });
}

export async function PATCH(
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
  const patch: Partial<WishlistInput> = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Item name cannot be empty" }, { status: 400 });
    patch.name = name;
  }
  if (body.category !== undefined) {
    patch.category = typeof body.category === "string" ? body.category.trim() : "misc";
  }
  if (body.subcategory !== undefined) {
    patch.subcategory = typeof body.subcategory === "string" ? body.subcategory.trim() : "";
  }
  if (body.price !== undefined) {
    patch.price = money(body.price);
  }
  if (body.url !== undefined) {
    patch.url = typeof body.url === "string" ? body.url.trim() : "";
  }
  if (body.notes !== undefined) {
    patch.notes = typeof body.notes === "string" ? body.notes.trim() : "";
  }
  if (body.priority !== undefined) {
    patch.priority = parseWishlistPriority(body.priority);
  }

  const updated = updateWishlistItem(user.id, numId, patch);
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const deleted = deleteWishlistItem(user.id, numId);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

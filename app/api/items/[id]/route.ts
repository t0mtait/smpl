import { NextResponse } from "next/server";
import { deleteItem, getItem, restoreItem, updateItem } from "@/lib/db";
import type { ItemStatus, Priority, UseFrequency } from "@/lib/db";
import { apiUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const item = getItem(user.id, Number(id));
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const itemId = Number(id);
  if (!getItem(user.id, itemId)) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.category === "string") patch.category = body.category.trim() || "uncategorized";
  if (typeof body.description === "string") patch.description = body.description;
  if (typeof body.location === "string") patch.location = body.location;
  if (body.purchaseDate === null || typeof body.purchaseDate === "string") {
    patch.purchaseDate = body.purchaseDate || null;
  }
  if (body.offloadedDate === null || typeof body.offloadedDate === "string") {
    patch.offloadedDate = body.offloadedDate || null;
  }
  if (body.lastUsedAt === null || typeof body.lastUsedAt === "string") {
    patch.lastUsedAt = body.lastUsedAt || null;
  }
  // Money accepts a number, an explicit null (unknown) or an empty string
  // (also unknown). A blank field must never become $0.
  for (const key of ["purchasePrice", "currentValue"]) {
    if (body[key] === null) {
      patch[key] = null;
    } else if (body[key] !== undefined && body[key] !== "") {
      const n = Number(body[key]);
      if (Number.isFinite(n)) patch[key] = n;
    }
  }
  const statuses: ItemStatus[] = ["owned", "sold", "donated", "disposed", "closed", "purgatory"];
  if (statuses.includes(body.status as ItemStatus)) patch.status = body.status;
  const freqs: UseFrequency[] = [
    "daily",
    "weekly",
    "monthly",
    "seasonal",
    "rare",
    "never",
    "unknown",
  ];
  if (freqs.includes(body.useFrequency as UseFrequency)) patch.useFrequency = body.useFrequency;
  const priorities: Priority[] = ["auto", "keep", "get_rid"];
  if (priorities.includes(body.priority as Priority)) patch.priority = body.priority;
  if (typeof body.photoPath === "string" || body.photoPath === null) {
    patch.photoPath = body.photoPath || null;
  }

  const item = updateItem(user.id, itemId, patch);
  return NextResponse.json({ item });
}

/** Delete an item outright (with its disposal history). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const ok = deleteItem(user.id, Number(id));
  if (!ok) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Restore a sold/donated/disposed item back to owned. */
export async function PUT(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const item = restoreItem(user.id, Number(id));
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return NextResponse.json({ item });
}

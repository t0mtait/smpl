import { NextResponse } from "next/server";
import { deleteItem, getItem, restoreItem, updateItem } from "@/lib/db";
import type { ItemStatus, Priority, UseFrequency } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const item = getItem(Number(id));
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return NextResponse.json({ item });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const itemId = Number(id);
  if (!getItem(itemId)) return NextResponse.json({ error: "Item not found" }, { status: 404 });

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
  if (body.lastUsedAt === null || typeof body.lastUsedAt === "string") {
    patch.lastUsedAt = body.lastUsedAt || null;
  }
  for (const key of ["purchasePrice", "currentValue"]) {
    if (body[key] !== undefined) {
      const n = Number(body[key]);
      patch[key] = Number.isFinite(n) ? n : 0;
    }
  }
  const statuses: ItemStatus[] = ["owned", "sold", "donated", "disposed"];
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

  const item = updateItem(itemId, patch);
  return NextResponse.json({ item });
}

/** Delete an item outright (with its disposal history). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = deleteItem(Number(id));
  if (!ok) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Restore a sold/donated/disposed item back to owned. */
export async function PUT(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const item = restoreItem(Number(id));
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
  return NextResponse.json({ item });
}

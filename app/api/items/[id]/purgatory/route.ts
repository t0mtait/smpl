import { NextResponse } from "next/server";
import { getItem, moveItemToPurgatory, restoreItem } from "@/lib/db";
import { apiUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Move an item to purgatory. */
export async function POST(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const itemId = Number(id);
  if (!getItem(user.id, itemId)) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const item = moveItemToPurgatory(user.id, itemId);
  return NextResponse.json({ item });
}

/** Restore an item from purgatory back to owned. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const itemId = Number(id);
  if (!getItem(user.id, itemId)) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const item = restoreItem(user.id, itemId);
  return NextResponse.json({ item });
}

import { NextResponse } from "next/server";
import { getItem, duplicateItem } from "@/lib/db";
import { apiUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const itemId = Number(id);
  if (!getItem(user.id, itemId)) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const item = duplicateItem(user.id, itemId);
  if (!item) return NextResponse.json({ error: "Failed to duplicate item" }, { status: 500 });
  return NextResponse.json({ ok: true, item });
}

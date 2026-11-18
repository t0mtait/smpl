import { NextResponse } from "next/server";
import { getItem, offloadItem } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { currentQuarter } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Offload an item from purgatory or inventory. */
export async function POST(req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const itemId = Number(id);
  if (!getItem(user.id, itemId)) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // defaults apply
  }

  const rawAmount = body.amount !== undefined && body.amount !== null && body.amount !== ""
    ? Number(body.amount)
    : 0;
  const amount = Number.isFinite(rawAmount) ? Math.max(0, rawAmount) : 0;

  const dateStr =
    typeof body.date === "string" && body.date.trim()
      ? body.date.trim()
      : currentQuarter();

  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  const item = offloadItem(user.id, itemId, amount, dateStr, notes);
  return NextResponse.json({ item });
}

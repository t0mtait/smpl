import { NextResponse } from "next/server";
import { disposeItem, getItem } from "@/lib/db";
import type { Disposition } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISPOSITIONS: Disposition[] = ["sold", "donated", "disposed"];

type Ctx = { params: Promise<{ id: string }> };

/** Mark an item as sold, donated, or disposed. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const itemId = Number(id);
  if (!getItem(itemId)) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const disposition = body.disposition as Disposition;
  if (!DISPOSITIONS.includes(disposition)) {
    return NextResponse.json({ error: `disposition must be one of ${DISPOSITIONS.join(", ")}` }, { status: 400 });
  }

  const disposedAt =
    typeof body.disposedAt === "string" && body.disposedAt
      ? body.disposedAt.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const amount = Number(body.amount);
  const channel = typeof body.channel === "string" ? body.channel.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  // A donation or disposal has no price by default; only a sale earns money.
  const finalAmount = disposition === "sold" && Number.isFinite(amount) ? amount : 0;

  const item = disposeItem(itemId, disposition, disposedAt, finalAmount, channel, notes);
  return NextResponse.json({ item });
}

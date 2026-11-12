import { NextResponse } from "next/server";
import { disposeItem, getItem } from "@/lib/db";
import type { Disposition } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { today } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISPOSITIONS: Disposition[] = ["sold", "donated", "disposed", "closed"];

type Ctx = { params: Promise<{ id: string }> };

/** Mark an item as sold, donated, disposed, or closed. */
export async function POST(req: Request, { params }: Ctx) {
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

  const disposition = body.disposition as Disposition;
  if (!DISPOSITIONS.includes(disposition)) {
    return NextResponse.json({ error: `disposition must be one of ${DISPOSITIONS.join(", ")}` }, { status: 400 });
  }

  const disposedAt =
    typeof body.disposedAt === "string" && body.disposedAt
      ? body.disposedAt.slice(0, 10)
      : today();
  const channel = typeof body.channel === "string" ? body.channel.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  // A donation or disposal earns nothing, so its amount stays unknown rather
  // than a fake $0. A sale with no amount recorded is "proceeds unknown" too.
  const rawAmount = body.amount === null || body.amount === undefined || body.amount === ""
    ? null
    : Number(body.amount);
  const finalAmount =
    disposition === "sold" && rawAmount !== null && Number.isFinite(rawAmount) ? rawAmount : null;

  const item = disposeItem(user.id, itemId, disposition, disposedAt, finalAmount, channel, notes);
  return NextResponse.json({ item });
}

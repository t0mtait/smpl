import { NextResponse } from "next/server";
import { createItem, listItems } from "@/lib/db";
import type { ItemInput, ItemStatus, Priority, UseFrequency } from "@/lib/db";
import { quarterToIso } from "@/lib/dates";
import { apiUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: ItemStatus[] = ["owned", "sold", "donated", "disposed", "closed"];
const FREQUENCIES: UseFrequency[] = [
  "daily",
  "weekly",
  "monthly",
  "seasonal",
  "rare",
  "never",
  "unknown",
];
const PRIORITIES: Priority[] = ["auto", "keep", "get_rid"];

export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ items: listItems(user.id) });
}

/**
 * Money fields accept three states: a number, an explicit null ("I don't
 * know") or an empty/absent value (also "I don't know"). Only a real number
 * is ever stored — a blank field must never become $0.
 */
function money(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseInput(body: Record<string, unknown>): ItemInput {
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const status = STATUSES.includes(body.status as ItemStatus) ? (body.status as ItemStatus) : "owned";
  const useFrequency = FREQUENCIES.includes(body.useFrequency as UseFrequency)
    ? (body.useFrequency as UseFrequency)
    : "unknown";
  const priority = PRIORITIES.includes(body.priority as Priority)
    ? (body.priority as Priority)
    : "auto";

  return {
    name: str(body.name) || "Untitled item",
    brand: str(body.brand),
    category: str(body.category) || "uncategorized",
    subcategory: str(body.subcategory),
    quality: str(body.quality),
    description: str(body.description),
    location: str(body.location),
    purchaseDate:
      typeof body.purchaseDate === "string" && body.purchaseDate
        ? quarterToIso(body.purchaseDate) || body.purchaseDate
        : null,
    offloadedDate:
      typeof body.offloadedDate === "string" && body.offloadedDate
        ? quarterToIso(body.offloadedDate) || body.offloadedDate
        : null,
    purchasePrice: money(body.purchasePrice),
    currentValue: money(body.currentValue),
    status,
    lastUsedAt: typeof body.lastUsedAt === "string" && body.lastUsedAt ? body.lastUsedAt : null,
    useFrequency,
    photoPath: typeof body.photoPath === "string" && body.photoPath ? body.photoPath : null,
    priority,
  };
}

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const item = createItem(user.id, parseInput(body));
  return NextResponse.json({ item }, { status: 201 });
}

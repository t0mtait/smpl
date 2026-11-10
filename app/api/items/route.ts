import { NextResponse } from "next/server";
import { createItem, listItems } from "@/lib/db";
import type { ItemInput, ItemStatus, Priority, UseFrequency } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: ItemStatus[] = ["owned", "sold", "donated", "disposed"];
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
  return NextResponse.json({ items: listItems() });
}

function parseInput(body: Record<string, unknown>): ItemInput {
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
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
    category: str(body.category) || "uncategorized",
    description: str(body.description),
    location: str(body.location),
    purchaseDate: typeof body.purchaseDate === "string" && body.purchaseDate ? body.purchaseDate : null,
    purchasePrice: num(body.purchasePrice),
    currentValue: num(body.currentValue),
    status,
    lastUsedAt: typeof body.lastUsedAt === "string" && body.lastUsedAt ? body.lastUsedAt : null,
    useFrequency,
    photoPath: typeof body.photoPath === "string" && body.photoPath ? body.photoPath : null,
    priority,
  };
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const item = createItem(parseInput(body));
  return NextResponse.json({ item }, { status: 201 });
}

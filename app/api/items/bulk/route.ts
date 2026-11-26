import path from "node:path";
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { scheduleAutoBackup } from "@/lib/backup";
import { deleteFile } from "@/lib/storage";
import { today } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, itemIds } = body;
  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return NextResponse.json({ error: "itemIds must be a non-empty array of numbers" }, { status: 400 });
  }

  const numericIds = itemIds.map(Number).filter(Number.isFinite);
  if (numericIds.length === 0) {
    return NextResponse.json({ error: "No valid item IDs provided" }, { status: 400 });
  }

  const d = getDb();
  const placeholders = numericIds.map(() => "?").join(",");

  // Verify and fetch targeted items owned by user
  const ownedItems = d
    .prepare(
      `SELECT id, photo_path, status FROM items WHERE owner_id = ? AND id IN (${placeholders})`
    )
    .all(user.id, ...numericIds) as { id: number; photo_path: string | null; status: string }[];

  if (ownedItems.length === 0) {
    return NextResponse.json({ error: "No matching items found for user" }, { status: 404 });
  }

  const targetIds = ownedItems.map((i) => i.id);
  const targetPlaceholders = targetIds.map(() => "?").join(",");

  if (action === "purgatory") {
    const todayStr = today();
    d.prepare(
      `UPDATE items
       SET status = 'purgatory',
           purgatory_date = ?,
           updated_at = datetime('now')
       WHERE owner_id = ? AND id IN (${targetPlaceholders})`
    ).run(todayStr, user.id, ...targetIds);

    scheduleAutoBackup();
    return NextResponse.json({ ok: true, count: targetIds.length });
  }

  if (action === "delete") {
    // Clean up photos for deleted items
    for (const item of ownedItems) {
      if (item.photo_path) {
        await deleteFile(path.basename(item.photo_path));
      }
    }

    // Delete disposals then items
    d.prepare(`DELETE FROM disposals WHERE item_id IN (${targetPlaceholders})`).run(...targetIds);
    d.prepare(`DELETE FROM items WHERE owner_id = ? AND id IN (${targetPlaceholders})`).run(
      user.id,
      ...targetIds
    );

    scheduleAutoBackup();
    return NextResponse.json({ ok: true, count: targetIds.length });
  }

  if (action === "category") {
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const subcategory = typeof body.subcategory === "string" ? body.subcategory.trim() : "";
    if (!category) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }

    d.prepare(
      `UPDATE items
       SET category = ?,
           subcategory = ?,
           updated_at = datetime('now')
       WHERE owner_id = ? AND id IN (${targetPlaceholders})`
    ).run(category, subcategory, user.id, ...targetIds);

    scheduleAutoBackup();
    return NextResponse.json({ ok: true, count: targetIds.length });
  }

  if (action === "priority") {
    const priority = body.priority;
    if (priority !== "keep" && priority !== "get_rid" && priority !== "auto") {
      return NextResponse.json({ error: "Invalid priority value" }, { status: 400 });
    }

    d.prepare(
      `UPDATE items
       SET priority = ?,
           updated_at = datetime('now')
       WHERE owner_id = ? AND id IN (${targetPlaceholders})`
    ).run(priority, user.id, ...targetIds);

    scheduleAutoBackup();
    return NextResponse.json({ ok: true, count: targetIds.length });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

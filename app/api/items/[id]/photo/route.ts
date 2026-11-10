import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, getItem, updateItem } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
  ["image/heic", "heic"],
]);

type Ctx = { params: Promise<{ id: string }> };

/** Upload (or replace) an item photo. Multipart form field name: "photo". */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const itemId = Number(id);
  const item = getItem(itemId);
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file in field \"photo\"" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
  }
  const ext = ALLOWED.get(file.type);
  if (!ext) {
    return NextResponse.json(
      { error: `Unsupported type ${file.type}. Allowed: ${[...ALLOWED.keys()].join(", ")}` },
      { status: 415 }
    );
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const filename = `item-${itemId}-${Date.now()}.${ext}`;
  const dest = path.join(UPLOAD_DIR, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(dest, bytes);

  // Remove the previous photo so the upload dir doesn't grow forever.
  if (item.photoPath) {
    const old = path.join(UPLOAD_DIR, path.basename(item.photoPath));
    if (old !== dest && fs.existsSync(old)) {
      try {
        fs.unlinkSync(old);
      } catch {
        // Non-fatal: a stale file is not worth failing the upload.
      }
    }
  }

  const updated = updateItem(itemId, { photoPath: filename });
  return NextResponse.json({ item: updated, photoPath: filename, bytes: bytes.length });
}

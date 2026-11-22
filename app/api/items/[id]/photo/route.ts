import { NextResponse } from "next/server";
import path from "node:path";
import { getItem, updateItem } from "@/lib/db";
import { apiUser } from "@/lib/auth";
import { saveFile, deleteFile } from "@/lib/storage";

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
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { id } = await params;
  const itemId = Number(id);
  const item = getItem(user.id, itemId);
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

  // The owner id is part of the filename so one account's uploads can never
  // collide with another's.
  const filename = `u${user.id}-item-${itemId}-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await saveFile({ filename, buffer: bytes, contentType: file.type });

  // Remove the previous photo so storage doesn't grow forever.
  if (item.photoPath) {
    const old = path.basename(item.photoPath);
    if (old !== filename) {
      await deleteFile(old);
    }
  }

  const updated = updateItem(user.id, itemId, { photoPath: filename });
  return NextResponse.json({ item: updated, photoPath: filename, bytes: bytes.length });
}

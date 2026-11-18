import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, getItemByPhotoPath } from "@/lib/db";
import { apiUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ name: string }> };

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
};

/** Serve an uploaded item photo — only to the account that owns the item. */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { name } = await params;
  // basename() defeats any path traversal attempt in the URL.
  const safe = path.basename(name);
  // The filename alone is not authorization — confirm the signed-in account
  // owns the item this photo belongs to, or is the user's avatar.
  const isAvatar = user.avatarPath === safe || safe.startsWith(`u${user.id}-avatar-`);
  const item = isAvatar ? null : getItemByPhotoPath(user.id, safe);
  if (!isAvatar && !item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ext = safe.split(".").pop()?.toLowerCase() ?? "";
  const file = path.join(UPLOAD_DIR, safe);
  if (!fs.existsSync(file)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const buf = fs.readFileSync(file);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

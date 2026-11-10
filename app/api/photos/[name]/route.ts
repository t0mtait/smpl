import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/db";

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

/** Serve an uploaded item photo. */
export async function GET(_req: Request, { params }: Ctx) {
  const { name } = await params;
  // basename() defeats any path traversal attempt in the URL.
  const safe = path.basename(name);
  const ext = safe.split(".").pop()?.toLowerCase() ?? "";
  const file = path.join(UPLOAD_DIR, safe);
  if (!fs.existsSync(file)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const buf = fs.readFileSync(file);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

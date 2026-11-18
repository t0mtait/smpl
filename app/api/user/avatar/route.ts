import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, updateUserProfile } from "@/lib/db";
import { apiUser } from "@/lib/auth";

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

/** Upload user avatar. Form field: "photo" or "avatar". */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("photo") ?? form.get("avatar");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided" }, { status: 400 });
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

  // Remove previous avatar file if exists
  if (user.avatarPath) {
    const oldFile = path.join(UPLOAD_DIR, path.basename(user.avatarPath));
    if (fs.existsSync(oldFile)) {
      try {
        fs.unlinkSync(oldFile);
      } catch {
        /* ignore */
      }
    }
  }

  const filename = `u${user.id}-avatar-${Date.now()}.${ext}`;
  const dest = path.join(UPLOAD_DIR, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(dest, buf);

  const updated = updateUserProfile(user.id, { avatarPath: filename });
  return NextResponse.json({ user: updated });
}

/** Remove user avatar. */
export async function DELETE() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  if (user.avatarPath) {
    const oldFile = path.join(UPLOAD_DIR, path.basename(user.avatarPath));
    if (fs.existsSync(oldFile)) {
      try {
        fs.unlinkSync(oldFile);
      } catch {
        /* ignore */
      }
    }
  }

  const updated = updateUserProfile(user.id, { avatarPath: null });
  return NextResponse.json({ user: updated });
}

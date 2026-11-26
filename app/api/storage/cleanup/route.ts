import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { cleanupOrphanedPhotos } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const result = await cleanupOrphanedPhotos();
    return NextResponse.json({ ok: true, result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Cleanup failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

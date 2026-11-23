import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { getBackupStatus, performDatabaseBackup } from "@/lib/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await apiUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const status = getBackupStatus();
  return NextResponse.json(status);
}

export async function POST() {
  const user = await apiUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const result = await performDatabaseBackup();
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Backup failed" }, { status: 500 });
  }

  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { createAlert, deleteAlert, listAlerts, snoozeAlert, toggleAlert } from "@/lib/db";
import { apiUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ alerts: listAlerts(user.id) });
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
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return NextResponse.json({ error: "label is required" }, { status: 400 });
  const cadence = Number(body.cadenceDays);
  const cadenceDays = Number.isFinite(cadence) && cadence >= 1 ? Math.min(365, Math.round(cadence)) : 30;
  const alert = createAlert(user.id, label, cadenceDays);
  return NextResponse.json({ alert }, { status: 201 });
}

export async function PATCH(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id is required" }, { status: 400 });

  if (body.action === "snooze") {
    snoozeAlert(user.id, id);
  } else if (body.action === "toggle") {
    toggleAlert(user.id, id, Boolean(body.active));
  } else {
    return NextResponse.json({ error: "action must be snooze or toggle" }, { status: 400 });
  }
  return NextResponse.json({ alerts: listAlerts(user.id) });
}

export async function DELETE(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ error: "id is required" }, { status: 400 });
  deleteAlert(user.id, id);
  return NextResponse.json({ alerts: listAlerts(user.id) });
}

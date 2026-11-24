import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { updateUserSubscription } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  return NextResponse.json({
    plan: user.plan,
    subscriptionInterval: user.subscriptionInterval,
    subscriptionRenewsAt: user.subscriptionRenewsAt,
  });
}

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const requestedPlan = body.plan === "free" ? "free" : "premium";
  const interval = body.interval === "yearly" ? "yearly" : body.interval === "trial" ? "trial" : "monthly";

  if (requestedPlan === "premium") {
    // 14 days for trial, 365 days for yearly, 30 days for monthly
    const days = interval === "trial" ? 14 : interval === "yearly" ? 365 : 30;
    const renewsAt = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    const updated = updateUserSubscription(user.id, "premium", interval, renewsAt);
    return NextResponse.json({ ok: true, user: updated });
  } else {
    const updated = updateUserSubscription(user.id, "free", null, null);
    return NextResponse.json({ ok: true, user: updated });
  }
}

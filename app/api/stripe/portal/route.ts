import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { getUserById, setStripeCustomerId } from "@/lib/db";
import { stripe, APP_URL } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const sessionUser = await apiUser();
  if (!sessionUser) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const user = getUserById(sessionUser.id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId: String(user.id) },
      });
      customerId = customer.id;
      setStripeCustomerId(user.id, customerId);
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL}/account`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: unknown) {
    console.error("Stripe Portal error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to open billing portal" },
      { status: 500 }
    );
  }
}

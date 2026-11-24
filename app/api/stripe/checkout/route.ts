import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth";
import { getUserById, setStripeCustomerId } from "@/lib/db";
import { stripe, STRIPE_PRICES, APP_URL } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sessionUser = await apiUser();
  if (!sessionUser) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const user = getUserById(sessionUser.id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: { interval?: "monthly" | "yearly" } = {};
  try {
    body = await req.json();
  } catch {}

  const interval = body.interval === "yearly" ? "yearly" : "monthly";
  const priceId = STRIPE_PRICES[interval];

  if (!priceId) {
    return NextResponse.json({ error: "Stripe Price ID not configured" }, { status: 500 });
  }

  try {
    // 1. Ensure or create a Stripe Customer
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

    // 2. Create Stripe Checkout Session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      client_reference_id: String(user.id),
      metadata: {
        userId: String(user.id),
        interval,
      },
      subscription_data: {
        metadata: {
          userId: String(user.id),
          interval,
        },
      },
      success_url: `${APP_URL}/account?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${APP_URL}/account#subscription`,
      // Managed Payments is on by default for this account and demands a
      // product tax code. We opt out per session and handle tax ourselves.
      managed_payments: { enabled: false },
    } as Parameters<typeof stripe.checkout.sessions.create>[0]);

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err: unknown) {
    console.error("Stripe Checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

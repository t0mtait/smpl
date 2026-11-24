import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  getUserById,
  getUserByStripeCustomer,
  updateUserSubscription,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_NVySkznYVoIwDoiNvPNDMesvGkwl9o6l";

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: `Webhook Error: ${err instanceof Error ? err.message : "Invalid signature"}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const userIdStr = session.client_reference_id || session.metadata?.userId;

        if (userIdStr && subscriptionId) {
          const userId = Number(userIdStr);
          const sub = (await stripe.subscriptions.retrieve(subscriptionId)) as any;
          const recurringInterval = sub.items?.data?.[0]?.price?.recurring?.interval;
          const interval =
            recurringInterval === "year" ? "yearly" : recurringInterval === "week" ? "trial" : "monthly";
          const currentPeriodEnd = (sub.current_period_end || sub.items?.data?.[0]?.current_period_end) as number;
          const renewsAt = currentPeriodEnd
            ? new Date(currentPeriodEnd * 1000).toISOString().slice(0, 10)
            : null;

          updateUserSubscription(userId, "premium", interval, renewsAt, customerId, subscriptionId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as any;
        const customerId = sub.customer as string;
        const subscriptionId = sub.id as string;
        const status = sub.status as string;

        let user = getUserByStripeCustomer(customerId);
        if (!user && sub.metadata?.userId) {
          user = getUserById(Number(sub.metadata.userId));
        }

        if (user) {
          if (status === "active" || status === "trialing") {
            const recurringInterval = sub.items?.data?.[0]?.price?.recurring?.interval;
            const interval =
              recurringInterval === "year" ? "yearly" : recurringInterval === "week" ? "trial" : "monthly";
            const currentPeriodEnd = (sub.current_period_end || sub.items?.data?.[0]?.current_period_end) as number;
            const renewsAt = currentPeriodEnd
              ? new Date(currentPeriodEnd * 1000).toISOString().slice(0, 10)
              : null;

            updateUserSubscription(user.id, "premium", interval, renewsAt, customerId, subscriptionId);
          } else if (status === "canceled" || status === "unpaid") {
            updateUserSubscription(user.id, "free", null, null, customerId, null);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        const customerId = sub.customer as string;
        let user = getUserByStripeCustomer(customerId);
        if (!user && sub.metadata?.userId) {
          user = getUserById(Number(sub.metadata.userId));
        }

        if (user) {
          updateUserSubscription(user.id, "free", null, null, customerId, null);
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    console.error("Error processing Stripe webhook:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

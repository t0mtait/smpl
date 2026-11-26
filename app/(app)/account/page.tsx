import { requireUser } from "@/lib/auth";
import { getUserById, listUserCategories, updateUserSubscription } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import AccountClient from "./AccountClient";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ session_id?: string; success?: string }>;
}) {
  const user = await requireUser("/account");
  let freshUser = getUserById(user.id) ?? user;

  const { session_id } = (await searchParams) ?? {};

  // 1. Direct return from Stripe checkout with session_id
  if (session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session && (session.status === "complete" || session.payment_status === "paid") && session.subscription) {
        const sub = (await stripe.subscriptions.retrieve(session.subscription as string)) as any;
        const recurringInterval = sub.items?.data?.[0]?.price?.recurring?.interval;
        const interval =
          recurringInterval === "year" ? "yearly" : recurringInterval === "week" ? "trial" : "monthly";
        const currentPeriodEnd = (sub.current_period_end || sub.items?.data?.[0]?.current_period_end || sub.trial_end) as number | undefined;
        const renewsAt = currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000).toISOString().slice(0, 10)
          : new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

        const updated = updateUserSubscription(
          freshUser.id,
          "premium",
          interval,
          renewsAt,
          (session.customer as string) || freshUser.stripeCustomerId,
          sub.id as string
        );
        if (updated) freshUser = updated;
      }
    } catch (err) {
      console.error("Failed to verify checkout session on account page:", err);
    }
  }

  // 2. Fallback auto-sync: If user is on 'free' plan, check Stripe for any active or trialing subscription
  if (freshUser.plan === "free") {
    try {
      let customerId = freshUser.stripeCustomerId;
      if (!customerId) {
        const customers = await stripe.customers.list({ email: freshUser.email, limit: 1 });
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;
        }
      }

      if (customerId) {
        const subs = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 3,
        });
        const activeSub = subs.data.find(
          (s) => s.status === "active" || s.status === "trialing"
        ) as any;

        if (activeSub) {
          const recurringInterval = activeSub.items?.data?.[0]?.price?.recurring?.interval;
          const interval =
            recurringInterval === "year" ? "yearly" : recurringInterval === "week" ? "trial" : "monthly";
          const currentPeriodEnd = (activeSub.current_period_end ||
            activeSub.items?.data?.[0]?.current_period_end ||
            activeSub.trial_end) as number | undefined;
          const renewsAt = currentPeriodEnd
            ? new Date(currentPeriodEnd * 1000).toISOString().slice(0, 10)
            : new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

          const updated = updateUserSubscription(
            freshUser.id,
            "premium",
            interval,
            renewsAt,
            customerId,
            activeSub.id as string
          );
          if (updated) freshUser = updated;
        }
      }
    } catch (err) {
      console.error("Failed to auto-sync Stripe subscription on account page:", err);
    }
  }

  const initialCategories = listUserCategories(freshUser.id);

  return <AccountClient initialUser={freshUser} initialCategories={initialCategories} />;
}

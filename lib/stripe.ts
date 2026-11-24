import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not defined in the environment");
    }
    stripeInstance = new Stripe(key, {
      apiVersion: "2025-02-24.acacia" as any,
      appInfo: {
        name: "smpl.",
        version: "0.1.0",
      },
    });
  }
  return stripeInstance;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const instance = getStripe();
    const val = (instance as any)[prop];
    return typeof val === "function" ? val.bind(instance) : val;
  },
});

export const STRIPE_PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || "price_1UfNMc2aeP0a2hjiwfmHMJfe",
  yearly: process.env.STRIPE_PRICE_YEARLY || "price_1UfNNE2aeP0a2hjirlZShG8X",
};

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "https://gosmpl.app");

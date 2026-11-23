import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-02-24.acacia" as any,
  appInfo: {
    name: "smpl.",
    version: "0.1.0",
  },
});

export const STRIPE_PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || "price_1Uf1fc2aeP0a2hjieExXfRFa",
  yearly: process.env.STRIPE_PRICE_YEARLY || "price_1Uf1fc2aeP0a2hjirtGv1DsM",
};

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "https://gosmpl.app");

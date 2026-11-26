"use client";

import { useEffect } from "react";
import { setClientCurrency } from "@/lib/format";

export function CurrencySync({ currency }: { currency?: string }) {
  const code = currency || "USD";
  useEffect(() => {
    setClientCurrency(code);
  }, [code]);
  return null;
}

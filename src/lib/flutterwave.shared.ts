// Client + server safe constants for Flutterwave subscriptions.
// Prices are charged through Flutterwave Standard checkout. We charge one
// period at a time (30d / 365d) and let the user re-subscribe — simpler
// than payment plans and lets us support multi-currency easily.

export type Plan = "monthly" | "yearly";

export type PriceRow = { monthly: number; yearly: number };

// Flutterwave-supported currencies we expose. Amounts are MAJOR units
// (Flutterwave's `amount` is a major-unit decimal, not cents).
// Keep these in sync with Flutterwave's currency list:
// https://developer.flutterwave.com/docs/collecting-payments/multicurrency-payments
export const PRICE_MATRIX: Record<string, PriceRow> = {
  USD: { monthly: 10, yearly: 120 },
  NGN: { monthly: 16000, yearly: 192000 },
  KES: { monthly: 1300, yearly: 15600 },
  GHS: { monthly: 150, yearly: 1800 },
  RWF: { monthly: 13500, yearly: 162000 },
  ZAR: { monthly: 185, yearly: 2220 },
  UGX: { monthly: 37000, yearly: 444000 },
  TZS: { monthly: 25000, yearly: 300000 },
};

export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  Nigeria: "NGN",
  Kenya: "KES",
  Ghana: "GHS",
  Rwanda: "RWF",
  "South Africa": "ZAR",
  Uganda: "UGX",
  Tanzania: "TZS",
};

export function currencyForCountry(country?: string | null): string {
  if (!country) return "USD";
  return COUNTRY_TO_CURRENCY[country] ?? "USD";
}

export function formatPrice(currency: string, amount: number): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "USD" || currency === "ZAR" || currency === "GHS" ? 2 : 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function periodEndForPlan(plan: Plan, from: Date = new Date()): Date {
  const d = new Date(from);
  if (plan === "monthly") d.setUTCDate(d.getUTCDate() + 30);
  else d.setUTCDate(d.getUTCDate() + 365);
  return d;
}

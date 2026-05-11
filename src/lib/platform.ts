// Detect whether the app is running inside a native iOS/Android shell
// (Capacitor). Used to comply with Apple/Google in-app purchase rules:
// digital subscriptions cannot be sold via Stripe inside the native apps,
// so we hide the Pro upgrade flow there and route users to the web.
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
  };
  const cap = w.Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
  if (typeof cap.getPlatform === "function") {
    const p = cap.getPlatform();
    return p === "ios" || p === "android";
  }
  return false;
}

export const WEB_UPGRADE_URL = "https://uipair.com/?upgrade=pro";

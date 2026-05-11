# Building UiPair for iOS and Android

UiPair is wrapped with **Capacitor**. Lovable handles the web app; you build the native iOS/Android binaries on your own machine and submit them to the stores.

## What's already configured

- `capacitor.config.ts` — app id `com.uipair.app`, name `UiPair`, brand colors, splash screen, status bar
- The native shell loads `https://uipair.com`, so any web update you publish from Lovable goes live in the apps **instantly** — no store resubmission needed for normal changes
- iOS + Android Capacitor packages installed

## One-time setup on your computer

You need to do this **outside Lovable**, on your own machine.

### Requirements
- **iOS:** macOS + [Xcode](https://apps.apple.com/us/app/xcode/id497799835) + [Apple Developer account](https://developer.apple.com/programs/) ($99/year)
- **Android:** [Android Studio](https://developer.android.com/studio) (Mac/Windows/Linux) + [Google Play Console account](https://play.google.com/console) ($25 one-time)
- [Node.js](https://nodejs.org) and [Bun](https://bun.sh)

### Steps

```bash
# 1. Clone your project from GitHub (connect GitHub in Lovable first)
git clone <your-repo-url>
cd <your-repo>
bun install

# 2. Add the native platforms (only once)
bunx cap add ios
bunx cap add android

# 3. Sync the Capacitor config into the native projects
bunx cap sync

# 4. Open in the native IDE
bunx cap open ios       # opens Xcode
bunx cap open android   # opens Android Studio
```

From there:
- **Xcode** → set your Team/signing → Product → Archive → upload to App Store Connect
- **Android Studio** → Build → Generate Signed Bundle (AAB) → upload to Google Play Console

## App store assets you'll need

- **Icons:** 1024×1024 master icon (use a tool like [icon.kitchen](https://icon.kitchen) to generate all sizes)
- **Splash screen:** 2732×2732 PNG with logo centered on `#1C1847`
- **Screenshots:** at least 3 per device size (iPhone 6.7", iPad 12.9", Android phone, Android tablet)
- **Listing copy:** name, short description, long description, keywords
- **Privacy policy URL:** `https://uipair.com/privacy` ✅ (already live)
- **Terms URL:** `https://uipair.com/terms` ✅ (already live)
- **Support email + age rating** (UiPair = 16+)

## ⚠️ Critical — Pro subscription compliance

Apple and Google **require** digital subscriptions to use their in-app purchase systems. Your Stripe-based $4/mo Pro plan **will get the app rejected** as-is.

You have two paths:

1. **Hide the Pro upgrade flow on mobile** for v1, route users to the web for upgrades. Fastest path to approval.
2. **Add native in-app purchases** via [RevenueCat](https://www.revenuecat.com) (free tier available) — Apple/Google will take 15–30%. Required if you want Pro to work inside the app.

Tell me which one you want and I'll implement it.

## Updating the apps later

- **Web changes (UI, features, fixes):** publish from Lovable → live in the apps within seconds. No store resubmission.
- **Native changes (icons, splash, plugins, permissions):** run `bunx cap sync` then rebuild + resubmit to the stores.

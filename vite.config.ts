// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// When SPA_BUILD=1 (set by `bun run build:client`), enable TanStack Start's SPA
// mode so the framework emits a static index.html that boots via createRoot()
// rather than hydrateRoot(). This lets the build run on static hosts like
// Vercel without the Cloudflare Worker SSR layer. The default (Lovable sandbox
// / Cloudflare) build keeps full SSR.
const isSpaBuild = process.env.SPA_BUILD === "1";

export default defineConfig({
  ...(isSpaBuild
    ? {
        nitro: false,
        tanstackStart: {
          spa: {
            enabled: true,
            maskPath: "/",
            prerender: { outputPath: "/index.html" },
          },
        },
      }
    : {}),
});

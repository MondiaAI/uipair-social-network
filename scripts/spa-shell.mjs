// Post-build step for the Vercel / static-host target.
//
// `vite build` (driven by @lovable.dev/vite-tanstack-config) emits the client
// bundle into dist/client/assets/* but does NOT write an index.html, because
// the Cloudflare Workers target serves the HTML shell from the server entry.
//
// For a static / SPA deploy (e.g. Vercel) we synthesize a minimal index.html
// that boots the same client entry. TanStack Router then takes over routing
// on the client. Routes that depend on SSR-only behavior (loaders that read
// server-only env, requireSupabaseAuth on public loaders, etc.) will fall
// back to client-side fetching — see the project's TanStack Start docs.

import { readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = "dist/client";
const ASSETS_DIR = join(OUT_DIR, "assets");

if (!existsSync(ASSETS_DIR)) {
  console.error(`[spa-shell] ${ASSETS_DIR} does not exist — run 'vite build' first.`);
  process.exit(1);
}

const files = readdirSync(ASSETS_DIR);
const entry =
  const entry =
  files.find((f) => /^main-[\w-]+\.js$/.test(f)) ||
  files.find((f) => /^index-[\w-]+\.js$/.test(f)) ||
  files.find((f) => /^(client|entry|app)-[\w-]+\.js$/.test(f)) ||
  files.find((f) => /^(__root|root|start|bundle)-[\w-]+\.js$/.test(f)) ||
  files.find((f) => f.endsWith(".js") && !f.includes("chunk") && !f.includes("vendor"));
if (!entry) {
  console.error("[spa-shell] Could not find a client entry chunk in", ASSETS_DIR);
  console.error("[spa-shell] Files seen:", files.slice(0, 20).join(", "));
  process.exit(1);
}

const css = files.filter((f) => f.endsWith(".css"));

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="manifest" href="/manifest.json" />
    <title>UiPair</title>
${css.map((f) => `    <link rel="stylesheet" href="/assets/${f}" />`).join("\n")}
    <script type="module" crossorigin src="/assets/${entry}"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

writeFileSync(join(OUT_DIR, "index.html"), html);
console.log(`[spa-shell] Wrote ${OUT_DIR}/index.html (entry: ${entry}, ${css.length} css)`);

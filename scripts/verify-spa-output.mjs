// Verifies the Vercel-targeted SPA build output:
//   1. dist/client/index.html exists and references a real entry chunk + CSS
//   2. The vercel.json rewrite rule routes all non-asset client paths to /index.html
//      (so /circles, /match, /lab, etc. never 404 on Vercel).
//
// Fails the CI job with a non-zero exit code if any check fails.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const OUT = "dist/client";
const INDEX = join(OUT, "index.html");

function fail(msg) {
  console.error(`[verify-spa-output] ❌ ${msg}`);
  process.exit(1);
}
function ok(msg) {
  console.log(`[verify-spa-output] ✅ ${msg}`);
}

// 1. index.html exists
if (!existsSync(INDEX)) fail(`Missing ${INDEX} — the SPA shell step did not run.`);
const html = readFileSync(INDEX, "utf8");
ok(`${INDEX} exists`);

// 2. references a real JS entry chunk
const scriptMatch = html.match(/<script[^>]+src="(\/assets\/[^"]+\.js)"/);
if (!scriptMatch) fail("index.html has no <script src=\"/assets/*.js\"> entry tag.");
const entryPath = join(OUT, scriptMatch[1].replace(/^\//, ""));
if (!existsSync(entryPath)) fail(`Entry chunk referenced by index.html is missing on disk: ${entryPath}`);
ok(`entry chunk present: ${scriptMatch[1]}`);

// 3. at least one CSS file referenced exists
const cssMatches = [...html.matchAll(/<link[^>]+href="(\/assets\/[^"]+\.css)"/g)];
if (cssMatches.length === 0) fail("index.html has no <link rel=\"stylesheet\" href=\"/assets/*.css\">.");
for (const m of cssMatches) {
  const p = join(OUT, m[1].replace(/^\//, ""));
  if (!existsSync(p)) fail(`CSS file referenced by index.html is missing: ${p}`);
}
ok(`${cssMatches.length} CSS file(s) present`);

// 4. <div id="root"> mount node exists
if (!/id="root"/.test(html)) fail("index.html has no <div id=\"root\"> mount node.");
ok("mount node #root present");

// 5. vercel.json rewrites all SPA client routes to /index.html
const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
const rewrites = vercel.rewrites || [];
if (rewrites.length === 0) fail("vercel.json has no rewrites — SPA deep links will 404.");

// Build a tester from the rewrite source pattern. We accept the canonical
// "everything except /assets/* or files with an extension" rule.
const spaRewrite = rewrites.find((r) => r.destination === "/index.html");
if (!spaRewrite) fail("vercel.json has no rewrite with destination \"/index.html\".");
let re;
try {
  // Strip Vercel's leading "/" — the source is a path pattern, not a JS regex
  // delimiter — and compile the inner group as RegExp.
  re = new RegExp("^" + spaRewrite.source + "$");
} catch (e) {
  fail(`vercel.json rewrite source is not a valid regex: ${spaRewrite.source}`);
}

const spaRoutes = [
  "/",
  "/feed",
  "/circles",
  "/circles/discover",
  "/match",
  "/lab",
  "/lab/abc-123",
  "/messages",
  "/settings",
  "/profile/some-user-id",
  "/login",
  "/signup",
];
const mustNotRewrite = [
  "/assets/index-abc.js",
  "/assets/main.css",
  "/favicon.svg",
  "/manifest.json",
  "/og-image.png",
];

for (const path of spaRoutes) {
  if (!re.test(path)) fail(`SPA route ${path} is NOT rewritten to /index.html — it will 404 on Vercel.`);
}
ok(`all ${spaRoutes.length} SPA routes rewrite to /index.html`);

for (const path of mustNotRewrite) {
  if (re.test(path)) fail(`Static asset ${path} would be rewritten to /index.html — assets must pass through.`);
}
ok(`${mustNotRewrite.length} static asset paths correctly bypass the rewrite`);

console.log("[verify-spa-output] ✅ All checks passed — Vercel SPA output is healthy.");

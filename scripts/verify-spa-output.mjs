// Verifies the static-host SPA build output (e.g. Hostinger shared hosting):
//   1. dist/client/index.html exists and references a real entry chunk + CSS
//   2. .htaccess ships in the output and rewrites non-asset client paths to
//      /index.html (so /circles, /match, /lab, etc. never 404 on refresh).
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

// 5. .htaccess ships in the build output with an SPA fallback rewrite
const HTACCESS = join(OUT, ".htaccess");
if (!existsSync(HTACCESS)) fail(`Missing ${HTACCESS} — SPA deep links will 404 on Apache-based hosts.`);
const htaccess = readFileSync(HTACCESS, "utf8");
if (!/RewriteEngine\s+On/i.test(htaccess)) fail(".htaccess has no \"RewriteEngine On\" directive.");
if (!/RewriteRule\s+\^\s+index\.html/i.test(htaccess)) {
  fail(".htaccess has no fallback RewriteRule to index.html.");
}
if (!/RewriteCond[^\n]+-f[\s\S]*RewriteCond[^\n]+-d/i.test(htaccess)) {
  fail(".htaccess is missing the -f/-d conditions that let real files/assets pass through untouched.");
}
ok(".htaccess present with SPA fallback rewrite and asset passthrough");

console.log("[verify-spa-output] ✅ All checks passed — static SPA output is healthy.");

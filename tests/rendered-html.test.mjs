import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the finished Times Table Turbo product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Times Table Turbo/);
  assert.match(html, /READY\./);
  assert.match(html, /Choose your tables/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("includes the touch game, install metadata and static Pages build", async () => {
  const [page, css, manifest, sw, docsFiles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readdir(new URL("../docs/", import.meta.url)),
  ]);

  assert.match(page, /aria-label="Answer keypad"/);
  assert.match(page, /Touch|made for tapping/i);
  assert.match(page, /serviceWorker/);
  assert.match(page, /ROUND_SECONDS = 60/);
  assert.match(page, /Array\.from\(\{ length: 12 \}/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /env\(safe-area-inset/);
  assert.match(css, /\.number-pad button[\s\S]*min-height/);

  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.display, "standalone");
  assert.equal(parsedManifest.name, "Times Table Turbo");
  assert.match(sw, /CACHE_NAME = "times-table-turbo-v1"/);
  assert.ok(docsFiles.includes("index.html"));
  assert.ok(docsFiles.includes("manifest.webmanifest"));
  assert.ok(docsFiles.includes("og.png"));
});

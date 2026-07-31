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

test("server-renders Jarlath and Anya's Times Table Turbo", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Jarlath and Anya/);
  assert.match(html, /READY\./);
  assert.match(html, /Choose your tables/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/);
});

test("includes the touch game, live rooms, install metadata and Pages build", async () => {
  const [
    page,
    multiplayer,
    corrections,
    core,
    firebase,
    css,
    manifest,
    sw,
    docsFiles,
  ] =
    await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/MultiplayerGame.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CorrectionsReview.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/multiplayer-core.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/firebase.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readdir(new URL("../docs/", import.meta.url)),
  ]);

  assert.match(page, /aria-label="Answer keypad"/);
  assert.match(page, /FOCUS ONE/);
  assert.match(page, /selectionMode === "single"/);
  assert.match(page, /End this round and return to the home screen/);
  assert.match(page, /function exitToHome\(\)/);
  assert.match(page, /Touch|made for tapping/i);
  assert.match(page, /serviceWorker/);
  assert.match(page, /ROUND_SECONDS = 60/);
  assert.match(page, /Array\.from\(\{ length: 12 \}/);
  assert.match(page, /Race Mode/);
  assert.match(page, /Team Turbo/);
  assert.match(page, /Join Room/);
  assert.match(page, /MultiplayerGame/);
  assert.match(page, /recordMistake/);
  assert.match(page, /correctionsRequired/);
  assert.match(multiplayer, /onValue/);
  assert.match(multiplayer, /runTransaction/);
  assert.match(multiplayer, /serverTimeOffset/);
  assert.match(multiplayer, /No accounts or chat/);
  assert.match(multiplayer, /mistakeKey/);
  assert.match(multiplayer, /CorrectionsReview/);
  assert.match(corrections, /I’VE READ MY CORRECTIONS/);
  assert.match(corrections, /missed \{mistake\.count\} times/);
  assert.match(corrections, /TRY IT AGAIN/);
  assert.match(corrections, /FINISH CORRECTION REVIEW/);
  assert.match(corrections, /feedback === "wrong" \? correctAnswer/);
  assert.match(corrections, /onComplete\(\)/);
  assert.match(core, /MULTIPLAYER_SECONDS = 60/);
  assert.match(core, /multiplayerQuestion/);
  assert.match(core, /createQuestionSequence/);
  assert.match(core, /questionAt/);
  assert.match(firebase, /signInAnonymously/);
  assert.match(firebase, /europe-west1\.firebasedatabase\.app/);
  assert.match(css, /touch-action:\s*manipulation/);
  assert.match(css, /env\(safe-area-inset/);
  assert.match(css, /\.number-pad button[\s\S]*min-height/);

  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.display, "standalone");
  assert.equal(parsedManifest.name, "Jarlath and Anya's Times Table Turbo");
  assert.match(sw, /CACHE_NAME = "times-table-turbo-v5"/);
  assert.match(sw, /requestUrl\.origin !== self\.location\.origin/);
  assert.ok(docsFiles.includes("index.html"));
  assert.ok(docsFiles.includes("manifest.webmanifest"));
  assert.ok(docsFiles.includes("og.png"));
});

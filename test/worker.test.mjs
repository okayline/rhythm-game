import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

const env = { ASSETS: { fetch: async () => new Response("page") } };
const HASH = "ab".repeat(32);
const withFetch = async (answer, run) => {   // stands in for Beat Fighter's /api/today
  const real = globalThis.fetch; globalThis.fetch = async () => answer();
  try { return await run(); } finally { globalThis.fetch = real; }
};

test("/api/today passes on Beat Fighter's day and hash, and nothing else", async () => {
  const res = await withFetch(() => Response.json({ day: "2026-11-18", hash: HASH, run: { perfect: 3 }, carry: null }),
    () => worker.fetch(new Request("https://x/api/today"), env));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { day: "2026-11-18", hash: HASH });
});

test("/api/today answers 502 when Beat Fighter is down or answers something odd", async () => {
  for (const answer of [() => new Response("no", { status: 500 }), () => Response.json({ day: "2026-11-18", hash: "zz" }), () => { throw new Error("offline"); }]) {
    const res = await withFetch(answer, () => worker.fetch(new Request("https://x/api/today"), env));
    assert.equal(res.status, 502);
  }
});

test("everything else is the page", async () => {
  assert.equal(await (await worker.fetch(new Request("https://x/"), env)).text(), "page");
});

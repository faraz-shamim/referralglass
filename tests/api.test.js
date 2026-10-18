import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
let server, url;
test.before(async () => {
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  url = "http://127.0.0.1:" + server.address().port;
});
test.after(async () => await new Promise((r) => server.close(r)));
test("Health declares a stateless service with no document upload endpoint", async () => {
  const r = await fetch(url + "/api/health"),
    data = await r.json();
  assert.equal(data.ok, true);
  assert.equal(data.storage, "none");
  assert.equal(data.documentTextAccepted, false);
  assert.equal(r.headers.get("cache-control"), "no-store");
});
test("The real HTTP planner accepts bounded metadata and returns a review plan", async () => {
  const r = await fetch(url + "/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 1,
        requirements: [
          {
            id: "r0",
            candidates: [
              {
                ref: "d0:p1:c0",
                score: 0.7,
                absence: false,
                dateIssue: false,
                ocr: false,
                weakOcr: false,
              },
            ],
          },
        ],
      }),
    }),
    p = await r.json();
  assert.equal(r.status, 200);
  assert.equal(p.autoApproved, 0);
  assert.equal(p.results[0].selectedRef, "d0:p1:c0");
  assert.equal(p.results[0].state, "review");
  assert.equal(typeof p.durationMs, "number");
});
test("Raw document text is rejected and never reflected in an error response", async () => {
  const marker = "SYNTHETIC_PRIVATE_MARKER_1184",
    r = await fetch(url + "/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: 1,
        requirements: [],
        documentText: marker,
      }),
    });
  assert.equal(r.status, 400);
  assert.ok(!(await r.text()).includes(marker));
});
test("Malformed JSON and oversized requests fail without revealing body content", async () => {
  const marker = "PRIVATE_CONTENT_TEST",
    r = await fetch(url + "/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"x":"' + marker,
    });
  assert.equal(r.status, 400);
  assert.ok(!(await r.text()).includes(marker));
  const big = await fetch(url + "/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x: "x".repeat(34000) }),
  });
  assert.equal(big.status, 413);
});
test("Upload attempts are unavailable and client protection headers are set", async () => {
  const r = await fetch(url + "/api/upload", {
    method: "POST",
    body: "not a real document",
  });
  assert.equal(r.status, 404);
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.ok(
    r.headers.get("content-security-policy").includes("object-src 'none'"),
  );
});

import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
test("Compressed scripts, styles and WASM retain valid browser MIME types", async () => {
  const dir = "test-results/test-static";
  await mkdir(dir + "/assets", { recursive: true });
  const files = [
    ["sample.js", "text/javascript", "export const x=1;"],
    ["sample.css", "text/css", "body{color:black}"],
    [
      "sample.wasm",
      "application/wasm",
      Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]),
    ],
  ];
  for (const [name, , bytes] of files) {
    await writeFile(dir + "/assets/" + name, bytes);
    await writeFile(dir + "/assets/" + name + ".gz", gzipSync(bytes));
  }
  const staticServer = createApp({ staticDir: dir }).listen(0, "127.0.0.1");
  await new Promise((r) => staticServer.once("listening", r));
  try {
    for (const [name, mime, bytes] of files) {
      const response = await fetch(
        "http://127.0.0.1:" + staticServer.address().port + "/assets/" + name,
        { headers: { "Accept-Encoding": "gzip" } },
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-encoding"), "gzip");
      assert.ok(response.headers.get("content-type").startsWith(mime));
      assert.deepEqual(
        Buffer.from(await response.arrayBuffer()),
        Buffer.from(bytes),
      );
    }
  } finally {
    await new Promise((r) => staticServer.close(r));
  }
});

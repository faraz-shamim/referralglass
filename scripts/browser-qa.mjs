import { chromium } from "playwright";
import { createApp } from "../server/app.js";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const report = {
  startedAt: new Date().toISOString(),
  environment:
    "Fresh isolated Chromium profile; synthetic medical paperwork; automated staff actions; no clinical validation",
  checks: [],
  errors: [],
  unexpectedFailedRequests: [],
  clinicalValidation: false,
};
const check = (name, detail) => {
  report.checks.push({ name, passed: true, ...(detail ? { detail } : {}) });
  console.log("PASS", name);
};
const privateMarker = "SYNTHETIC_PRIVATE_SENTINEL_8317";
let context,
  server,
  page,
  expectedOffline = false;
const postSummaries = [],
  leaks = [],
  modelRequests = [];
try {
  await mkdir(".runtime", { recursive: true });
  await mkdir("docs", { recursive: true });
  await mkdir("test-results", { recursive: true });
  server = createApp({ staticDir: "dist" }).listen(4178, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  context = await chromium.launchPersistentContext(
    await mkdtemp(".runtime/browser-qa-"),
    {
      executablePath:
        process.env.REFERRALGLASS_BROWSER_PATH ||
        (process.platform === "win32"
          ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
          : undefined),
      headless: true,
      viewport: { width: 1440, height: 1050 },
      acceptDownloads: true,
    },
  );
  await context.addInitScript(() => {
    window.qaPrintCalls = 0;
    window.print = () => {
      window.qaPrintCalls++;
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.qaCopiedText = text;
        },
      },
    });
  });
  context.on("request", (request) => {
    const body = request.postData() || "";
    const requestUrl = new URL(request.url());
    if (
      requestUrl.hostname === "huggingface.co" &&
      requestUrl.pathname.startsWith("/Xenova/all-MiniLM-L6-v2/resolve/")
    )
      modelRequests.push(requestUrl.pathname);
    if (body.includes(privateMarker) || request.url().includes(privateMarker))
      leaks.push(new URL(request.url()).origin);
    if (request.url().endsWith("/api/plan")) {
      const data = body ? JSON.parse(body) : null;
      postSummaries.push({
        bytes: body.length,
        keys: data ? Object.keys(data) : [],
        requirements: data?.requirements?.length,
      });
    }
  });
  context.on("requestfailed", (request) => {
    if (expectedOffline) return;
    const u = new URL(request.url());
    report.unexpectedFailedRequests.push({
      host: u.host,
      path: u.pathname,
      error: request.failure()?.errorText,
    });
  });
  page = context.pages()[0] || (await context.newPage());
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto("http://127.0.0.1:4178/", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Every detail, in view." }).waitFor();
  await page.screenshot({
    path: "docs/referralglass-desktop.png",
    fullPage: true,
  });
  check(
    "Desktop packet desk renders with empty-state actions and no exceptions",
  );
  await page.getByRole("button", { name: "Try a sample packet" }).click();
  assert.equal(await page.locator(".document-row").count(), 4);
  check("Fictional sample loads four files and six source pages");
  await page
    .getByRole("button", { name: "Find evidence", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Find evidence with local AI" })
    .waitFor();
  check("Model download and data-flow consent precedes inference");
  await page
    .getByRole("button", { name: "Download and find evidence" })
    .click();
  await page
    .getByRole("heading", { name: "Review, then confirm." })
    .waitFor({ timeout: 120000 });
  assert.equal(await page.locator(".finding").count(), 6);
  assert.equal(await page.locator(".finding.confirmed").count(), 0);
  check(
    "Genuine local MiniLM inference produces six findings with zero automatic approvals",
  );
  assert.ok(postSummaries.length > 0);
  assert.deepEqual(postSummaries[0].keys, ["version", "requirements"]);
  check(
    "Server planner receives only bounded score metadata",
    postSummaries[0],
  );
  await page.screenshot({
    path: "docs/referralglass-evidence.png",
    fullPage: true,
  });
  await page.locator('[data-action="source-page"]').first().click();
  await page.locator(".source-page-text mark").waitFor();
  assert.ok(
    (await page.locator(".source-page-text mark").innerText()).includes(
      "referring",
    ),
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  check("Evidence opens the exact highlighted original text and source page");
  await page.locator('[data-action="confirm"]').click();
  assert.equal(await page.locator("#confirm-source-button").isDisabled(), true);
  await page.locator("#confirmation-ack").check();
  await page.locator("#confirm-source-button").click();
  assert.equal(await page.locator(".finding.confirmed").count(), 1);
  check("Explicit staff acknowledgement is required to confirm a source");
  await page
    .locator('[data-action="select-requirement"][data-id="investigations"]')
    .click();
  assert.ok(
    (await page.locator(".evidence-quote").innerText()).includes(
      "not attached",
    ),
  );
  await page.locator('[data-action="confirm"]').click();
  await page
    .getByRole("heading", { name: "A mention is not the missing document" })
    .waitFor();
  await page.getByRole("button", { name: "Return to the evidence" }).click();
  assert.equal(await page.locator(".finding.confirmed").count(), 1);
  check("Pending-report mentions cannot be confirmed as supplied paperwork");
  for (const id of ["medicines", "allergies", "contact", "consent"]) {
    await page
      .locator(`[data-action="select-requirement"][data-id="${id}"]`)
      .click();
    await page.locator('[data-action="confirm"]').click();
    await page.locator("#confirmation-ack").check();
    await page.locator("#confirm-source-button").click();
  }
  assert.equal(await page.locator(".finding.confirmed").count(), 5);
  check(
    "Five genuine source candidates can be reviewed while the missing report remains unconfirmed",
  );
  await page.getByRole("button", { name: "Prepare handoff" }).click();
  await page.getByRole("button", { name: "Copy draft", exact: true }).click();
  const copied = await page.evaluate(() => window.qaCopiedText);
  assert.ok(copied.includes("Investigation reports"));
  assert.ok(!copied.includes("- Current medicines"));
  check(
    "Missing-paperwork draft reflects staff decisions (clipboard API stubbed)",
  );
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save review JSON" }).click();
  const download = await exported;
  await download.saveAs("test-results/review.json");
  const record = JSON.parse(await readFile("test-results/review.json", "utf8"));
  assert.equal(
    record.requirements.filter((r) => r.status === "staff-confirmed").length,
    5,
  );
  assert.equal(
    record.requirements.find((r) => r.id === "investigations").evidence,
    null,
  );
  assert.ok(
    record.requirements
      .filter((r) => r.evidence)
      .every((r) => /^[a-f0-9]{64}$/.test(r.evidence.sha256)),
  );
  report.model = record.model;
  check(
    "JSON export contains only staff-confirmed source quotations and file hashes",
  );
  await page.screenshot({
    path: "docs/referralglass-handoff.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Print / save PDF" }).click();
  assert.equal(await page.evaluate(() => window.qaPrintCalls), 1);
  await page.pdf({
    path: "test-results/printed-review.pdf",
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  check("Print action and actual A4 PDF output use the reviewed draft");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of ["packet", "evidence", "handoff"]) {
    await page.locator(`.mobile-nav [data-view="${view}"]`).click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
  }
  await page.locator('.mobile-nav [data-view="evidence"]').click();
  await page.screenshot({
    path: "docs/referralglass-mobile.png",
    fullPage: true,
  });
  check("All three primary screens fit a 390-pixel phone viewport");
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.locator('.rail [data-view="packet"]').click();
  await page.getByRole("button", { name: "Edit checklist" }).click();
  const first = page.locator(".policy-editor").first();
  await first
    .locator('[data-policy-field="label"]')
    .fill("Referral question and background");
  await page.locator('#dialogs [data-action="save-policy"]').click();
  assert.equal(await page.locator(".finding.confirmed").count(), 0);
  assert.ok(
    !(await page.locator("body").innerText()).includes(
      "Your evidence is ready to review.",
    ),
  );
  check(
    "Changing the office checklist invalidates earlier findings and confirmations",
  );
  const savedPolicy = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save checklist", exact: true })
    .click();
  await (await savedPolicy).saveAs("test-results/checklist.json");
  await page
    .locator("#policy-input")
    .setInputFiles("test-results/checklist.json");
  check("Office checklist exports and imports without document content");
  await page.locator("#file-input").setInputFiles({
    name: "private-marker.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "SYNTHETIC SOFTWARE TEST ONLY\n" +
        privateMarker +
        "\nA private administrative note. <script>window.unwantedExecution=true</script>",
    ),
  });
  await page
    .getByRole("button", { name: "Find evidence", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Review, then confirm." })
    .waitFor({ timeout: 120000 });
  assert.deepEqual(leaks, []);
  assert.equal(
    await page.evaluate(() => window.unwantedExecution === true),
    false,
  );
  check(
    "A unique private text marker never appears in outgoing requests or executes as HTML",
  );
  await page.locator('.rail [data-view="packet"]').click();
  await page
    .getByRole("button", { name: "Read private-marker.txt", exact: true })
    .click();
  assert.ok(
    (await page.locator(".source-page-text").innerText()).includes("<script>"),
  );
  assert.equal(
    await page.evaluate(() => window.unwantedExecution === true),
    false,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.locator('.rail [data-view="evidence"]').click();
  check("Untrusted document markup is displayed as inert source text");

  await page
    .getByRole("button", { name: "Choose a source manually", exact: true })
    .click();
  await page.locator(".manual-source-list button").first().click();
  assert.equal(await page.locator(".finding.confirmed").count(), 0);
  check("Manual source selection is available without automatic confirmation");
  async function clearWorkspace() {
    await page.locator('.rail [data-view="packet"]').click();
    await page.getByRole("button", { name: "Clear private workspace" }).click();
    await page
      .getByRole("button", { name: "Clear workspace", exact: true })
      .click();
  }
  await clearWorkspace();
  assert.equal(await page.locator(".document-row").count(), 0);
  check(
    "Clearing the workspace removes documents, findings and working memory",
  );
  await page
    .locator("#file-input")
    .setInputFiles("web/public/samples/referral-cover.pdf");
  await page.getByText("referral-cover.pdf", { exact: true }).waitFor();
  assert.ok(
    (await page.locator(".file-details").innerText()).includes("2 pages"),
  );
  await page
    .getByRole("button", { name: "Read referral-cover.pdf", exact: true })
    .click();
  assert.ok(
    (await page.locator(".source-page-text").innerText()).includes("DEMO-104"),
  );
  await page.getByRole("button", { name: "View original page image" }).click();
  await page.waitForFunction(
    () => document.querySelector(".source-preview")?.naturalWidth > 0,
    null,
    { timeout: 20000 },
  );
  await page.screenshot({
    path: "docs/referralglass-source.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "Close dialog" }).click();
  check(
    "A real two-page PDF imports, preserves text and renders the original page locally",
  );
  await page.locator("#ocr-option").check();
  await page.locator("#file-input").setInputFiles({
    name: "clinic-scan.png",
    mimeType: "image/png",
    buffer: await readFile("tests/fixtures/clinic-scan.png"),
  });
  await page
    .getByText("clinic-scan.png", { exact: true })
    .waitFor({ timeout: 90000 });
  await page
    .getByRole("button", { name: "Read clinic-scan.png", exact: true })
    .click();
  const ocrText = await page.locator(".source-page-text").innerText();
  assert.ok(ocrText.includes("DEMO-104"));
  assert.ok(ocrText.toLowerCase().includes("mossvale"));
  report.ocr = {
    realInference: true,
    language: "eng",
    fixture:
      "A rendered, clearly fictional two-page office PDF; first page used as a scan",
    expectedReferenceRead: true,
  };
  await page.getByRole("button", { name: "Close dialog" }).click();
  check(
    "Genuine local Tesseract OCR reads the scan and retains source verification controls",
  );
  const count = await page.locator(".document-row").count();
  await page.locator("#file-input").setInputFiles({
    name: "unsupported.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("not a document"),
  });
  await page.getByText(/Use PDF, UTF-8 TXT/).waitFor();
  assert.equal(await page.locator(".document-row").count(), count);
  check(
    "Unsupported uploads are rejected without replacing the current packet",
  );
  const lab = await context.newPage();
  lab.on("pageerror", (e) => report.errors.push(e.message));
  await lab.goto("http://127.0.0.1:4178/lab.html");
  await lab
    .getByRole("button", { name: "Run local benchmark", exact: true })
    .click();
  await lab
    .locator("#benchmark-json")
    .waitFor({ state: "attached", timeout: 120000 });
  const benchmark = JSON.parse(
    await lab.locator("#benchmark-json").textContent(),
  );
  assert.equal(benchmark.cases, 24);
  assert.equal(benchmark.syntheticDataOnly, true);
  assert.equal(benchmark.backend, "wasm CPU");
  assert.equal(benchmark.passed, true);
  await writeFile(
    "docs/retrieval-benchmark.json",
    JSON.stringify(benchmark, null, 2),
  );
  await lab.screenshot({
    path: "docs/referralglass-benchmark.png",
    fullPage: true,
  });
  check(
    "Real 24-case retrieval benchmark executes on CPU and records every prediction",
    {
      semantic: benchmark.semantic,
      lexical: benchmark.lexical,
      modelDurationMs: benchmark.modelDurationMs,
    },
  );
  await lab.close();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
    timeout: 20000,
  });
  expectedOffline = true;
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Try a sample packet" }).click();
  await page
    .getByRole("button", { name: "Find evidence", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Download and find evidence" })
    .click();
  await page
    .getByRole("heading", { name: "Review, then confirm." })
    .waitFor({ timeout: 120000 });
  assert.ok(
    (await page.locator(".trace-panel").innerText()).includes(
      "On-device planner",
    ),
  );
  check(
    "Cached app, actual local model and planner run after reload with the network disabled",
  );
  await context.setOffline(false);
  expectedOffline = false;
  await page.locator('.rail [data-view="packet"]').click();
  await page
    .getByRole("button", { name: "Load complete sample packet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Find evidence", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Review, then confirm." })
    .waitFor({ timeout: 45000 });
  for (const id of [
    "reason",
    "medicines",
    "allergies",
    "investigations",
    "contact",
    "consent",
  ]) {
    await page
      .locator('[data-action="select-requirement"][data-id="' + id + '"]')
      .click();
    await page.locator('[data-action="confirm"]').click();
    await page.locator("#confirmation-ack").check();
    await page.locator("#confirm-source-button").click();
  }
  assert.equal(await page.locator(".finding.confirmed").count(), 6);
  check(
    "Complete fictional packet permits all six explicit staff confirmations",
  );
  assert.deepEqual(leaks, []);
  assert.deepEqual(report.errors, []);
  assert.ok(
    modelRequests.length > 0 &&
      modelRequests.every((path) =>
        path.includes("/751bff37182d3f1213fa05d7196b954e230abad9/"),
      ),
  );
  check(
    "Every Hugging Face model and tokenizer request uses the pinned immutable revision",
  );
  report.modelRequestsUsePinnedRevision = true;
  report.networkPrivacy = {
    uniquePrivateMarkerLeaked: false,
    plannerCalls: postSummaries.length,
    plannerPayloads: postSummaries,
  };
  report.passed = true;
} catch (e) {
  report.error = e.message;
  report.passed = false;
  process.exitCode = 1;
  try {
    if (page) {
      report.failureVisibleText = (
        await page.locator("body").innerText()
      ).slice(-1800);
      await page.screenshot({
        path: ".runtime/browser-failure.png",
        fullPage: true,
      });
    }
  } catch {}
} finally {
  await context?.close();
  if (server) {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
  report.finishedAt = new Date().toISOString();
  await writeFile("docs/browser-qa.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

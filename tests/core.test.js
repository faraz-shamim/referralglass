import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_REQUIREMENTS } from "../web/lib/config.js";
import {
  normalizeText,
  esc,
  validateRequirements,
  chunkDocuments,
  citationFor,
  rankEvidence,
  absenceMention,
  dateIssue,
  makeReport,
  missingRequest,
  lexicalRanking,
} from "../web/lib/core.js";
import { demoDocuments } from "../web/lib/demo.js";
const at = Date.UTC(2026, 9, 18, 12),
  requirements = structuredClone(DEFAULT_REQUIREMENTS);
test("Text is normalized while HTML content remains inert when displayed", () => {
  assert.equal(normalizeText("  ﬁle\r\nname\u0000  "), "file\nname");
  assert.equal(
    esc('<script>"x"&</script>'),
    "&lt;script&gt;&quot;x&quot;&amp;&lt;/script&gt;",
  );
});
test("Every passage resolves to an exact source range across multiple pages", () => {
  const docs = demoDocuments(),
    chunks = chunkDocuments(docs);
  assert.ok(chunks.length >= 6);
  for (const c of chunks) {
    const citation = citationFor(c.ref, chunks, docs);
    assert.ok(citation);
    assert.equal(
      citation.quote,
      docs[c.docIndex].pages[c.page - 1].text.slice(c.start, c.end),
    );
  }
});
test("Modified source text and invented references cannot become citations", () => {
  const docs = demoDocuments(),
    chunks = chunkDocuments(docs),
    first = chunks[0];
  docs[0].pages[0].text = "replacement";
  assert.equal(citationFor(first.ref, chunks, docs), null);
  assert.equal(citationFor("d99:p1:c0", chunks, docs), null);
});
test("Packet limits stop oversized untrusted text before model inference", () => {
  assert.throws(
    () =>
      chunkDocuments([
        { id: "x", pages: [{ number: 1, text: "a".repeat(240001) }] },
      ]),
    /too much|too many/,
  );
});
test("Checklist imports reject malformed, duplicate and unbounded requirements", () => {
  assert.throws(() => validateRequirements([]));
  assert.throws(() => validateRequirements([requirements[0], requirements[0]]));
  assert.throws(() =>
    validateRequirements([{ ...requirements[0], maxAgeDays: -1 }]),
  );
  assert.throws(() =>
    validateRequirements([{ ...requirements[0], query: "short" }]),
  );
  assert.throws(() =>
    validateRequirements([{ ...requirements[0], id: "<script>" }]),
  );
});
test("Missing paperwork is distinct from a documented absence of allergies", () => {
  for (const s of [
    "Imaging report is not attached.",
    "Laboratory results are not yet received.",
    "We are awaiting the report.",
    "Results pending.",
  ])
    assert.equal(absenceMention(s), true);
  assert.equal(absenceMention("No known drug allergies are recorded."), false);
  assert.equal(absenceMention("A complete report is enclosed."), false);
});
test("Office age limits flag unknown, old and future dates without inventing one", () => {
  const r = { maxAgeDays: 30 };
  assert.equal(dateIssue({ date: null }, r, at), true);
  assert.equal(dateIssue({ date: "2026-01-01" }, r, at), true);
  assert.equal(dateIssue({ date: "2026-12-01" }, r, at), true);
  assert.equal(dateIssue({ date: "2026-10-18" }, r, at), false);
  assert.equal(dateIssue({ date: null }, { maxAgeDays: 0 }, at), false);
});
test("Ranking preserves source quality flags and deterministic citations", () => {
  const docs = [
      {
        id: "d",
        hash: "h",
        name: "file.txt",
        date: "2026-10-18",
        pages: [
          {
            number: 1,
            text: "The imaging report is not attached.",
            ocr: true,
            confidence: 52,
          },
        ],
      },
    ],
    chunks = chunkDocuments(docs),
    ranked = rankEvidence(
      [{ id: "r", maxAgeDays: 30 }],
      chunks,
      [[1, 0]],
      [[1, 0]],
      at,
    );
  assert.equal(ranked[0].candidates[0].absence, true);
  assert.equal(ranked[0].candidates[0].weakOcr, true);
  assert.equal(ranked[0].candidates[0].dateIssue, false);
  assert.equal(ranked[0].candidates[0].score, 1);
});
test("A source match alone cannot become a confirmed report item", () => {
  const docs = demoDocuments(),
    chunks = chunkDocuments(docs);
  const state = {
    documents: docs,
    chunks,
    requirements: [requirements[0]],
    reviews: {},
    analysis: {
      results: [{ id: "reason", state: "review", selectedRef: chunks[0].ref }],
      runtime: "on-device",
    },
    caseLabel: "TEST",
    demo: true,
  };
  assert.equal(makeReport(state).requirements[0].evidence, null);
  assert.match(missingRequest(state), /Referral reason/);
  state.reviews.reason = { ref: chunks[0].ref, at: new Date(at).toISOString() };
  const record = makeReport(state);
  assert.equal(record.requirements[0].status, "staff-confirmed");
  assert.equal(record.requirements[0].evidence.quote, chunks[0].text);
  assert.match(missingRequest(state), /No outstanding/);
});
test("TF-IDF baseline uses document content, not expected labels", () => {
  const ranked = lexicalRanking("current medication list", [
    "A signed consent form.",
    "Current medication list reviewed.",
  ]);
  assert.equal(ranked[0].index, 1);
});

test("Text page separators survive normalization and impossible dates fail an office age check", () => {
  assert.deepEqual(normalizeText("First page\fSecond page").split("\f"), [
    "First page",
    "Second page",
  ]);
  assert.equal(
    dateIssue({ date: "2026-02-31" }, { maxAgeDays: 3650 }, at),
    true,
  );
});

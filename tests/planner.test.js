import test from "node:test";
import assert from "node:assert/strict";
import { planReview } from "../web/lib/planner.js";
const c = (ref = "d0:p1:c0", score = 0.7, extra = {}) => ({
  ref,
  score,
  absence: false,
  dateIssue: false,
  ocr: false,
  weakOcr: false,
  ...extra,
});
const plan = (candidates) =>
  planReview({ version: 1, requirements: [{ id: "r0", candidates }] });
test("Every possible match stops at human review with zero approvals", () => {
  for (const list of [
    [],
    [c()],
    [c("d0:p1:c0", 0.1)],
    [c("d0:p1:c0", 0.9, { absence: true })],
  ]) {
    const p = plan(list);
    assert.equal(p.autoApproved, 0);
    assert.equal(p.nextAction, "staff_review");
    assert.equal(p.results[0].requiresHumanReview, true);
  }
});
test("Absent or low-similarity evidence is not reported as found", () => {
  assert.equal(plan([]).results[0].state, "not-found");
  assert.equal(plan([c("d0:p1:c0", 0.1)]).results[0].selectedRef, null);
});
test("A pending-report mention is escalated rather than accepted", () => {
  const p = plan([c("d0:p1:c0", 0.9, { absence: true }), c("d1:p1:c0", 0.6)]);
  assert.equal(p.results[0].state, "conflict");
  assert.equal(p.results[0].selectedRef, "d0:p1:c0");
});
test("Similar matches in different documents are marked ambiguous", () =>
  assert.equal(
    plan([c("d0:p1:c0", 0.7), c("d1:p1:c0", 0.69)]).results[0].state,
    "ambiguous",
  ));
test("Date and low-quality OCR problems remain visible", () => {
  assert.match(
    plan([c("d0:p1:c0", 0.7, { dateIssue: true })]).results[0].reason,
    /date/,
  );
  assert.match(
    plan([c("d0:p1:c0", 0.7, { weakOcr: true, ocr: true })]).results[0].reason,
    /OCR/,
  );
});
test("Document text, names and unexpected fields are rejected by the planner schema", () => {
  for (const input of [
    { version: 1, requirements: [], documentText: "private" },
    {
      version: 1,
      requirements: [{ id: "r0", name: "private", candidates: [] }],
    },
    {
      version: 1,
      requirements: [{ id: "r0", candidates: [{ ...c(), text: "private" }] }],
    },
  ])
    assert.throws(
      () => planReview(input),
      (e) => e.status === 400 && !e.message.includes("private"),
    );
});
test("Invalid references, scores, duplicates and missing flags cannot enter a plan", () => {
  for (const candidate of [
    c("../../file"),
    c("d0:p1:c0", NaN),
    c("d0:p1:c0", 2),
    { ref: "d0:p1:c0", score: 0.8 },
  ])
    assert.throws(() => plan([candidate]));
  assert.throws(() =>
    planReview({
      version: 1,
      requirements: [
        { id: "r0", candidates: [] },
        { id: "r0", candidates: [] },
      ],
    }),
  );
});

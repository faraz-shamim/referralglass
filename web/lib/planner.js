export const PLANNER_VERSION = "1.0.0";
function invalid() {
  const e = new Error(
    "Only bounded anonymous retrieval scores are accepted. Do not send document text or identifiers.",
  );
  e.status = 400;
  throw e;
}
function keys(value, allowed) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !allowed.includes(k))
  )
    invalid();
}
export function planReview(input) {
  keys(input, ["version", "requirements"]);
  if (
    input.version !== 1 ||
    !Array.isArray(input.requirements) ||
    !input.requirements.length ||
    input.requirements.length > 12
  )
    invalid();
  const seen = new Set(),
    trace = [];
  const results = input.requirements.map((r) => {
    keys(r, ["id", "candidates"]);
    if (
      !/^[a-z][a-z0-9_-]{0,30}$/.test(r.id) ||
      seen.has(r.id) ||
      !Array.isArray(r.candidates) ||
      r.candidates.length > 5
    )
      invalid();
    seen.add(r.id);
    const candidates = r.candidates
      .map((c) => {
        keys(c, ["ref", "score", "absence", "dateIssue", "ocr", "weakOcr"]);
        if (
          !/^d\d{1,2}:p\d{1,3}:c\d{1,4}$/.test(c.ref) ||
          !Number.isFinite(c.score) ||
          c.score < -1 ||
          c.score > 1 ||
          ["absence", "dateIssue", "ocr", "weakOcr"].some(
            (k) => typeof c[k] !== "boolean",
          )
        )
          invalid();
        return c;
      })
      .sort((a, b) => b.score - a.score);
    const top = candidates[0],
      positive = candidates.filter((c) => !c.absence && c.score >= 0.28);
    let state = "not-found",
      reason = "No sufficiently similar passage was located.",
      selectedRef = null;
    if (top?.score >= 0.28) {
      if (top.absence) {
        state = "conflict";
        reason = "The closest passage mentions missing or pending paperwork.";
        selectedRef = top.ref;
      } else {
        selectedRef = top.ref;
        state = "review";
        reason = "Candidate source located. Staff must inspect and confirm it.";
        if (top.dateIssue) {
          state = "conflict";
          reason =
            "The document date is missing, in the future, or outside the office age limit.";
        } else if (top.weakOcr) {
          state = "conflict";
          reason =
            "OCR quality is low. Verify the source image before using this passage.";
        } else if (
          positive[1] &&
          positive[1].ref.split(":p")[0] !== top.ref.split(":p")[0] &&
          top.score - positive[1].score < 0.045
        ) {
          state = "ambiguous";
          reason =
            "Two documents have similar matches. Staff must choose the right source.";
        }
      }
    }
    trace.push({
      tool: "audit_candidate",
      requirementId: r.id,
      candidatesExamined: candidates.length,
      decision: state,
    });
    return {
      id: r.id,
      state,
      reason,
      selectedRef,
      score: top?.score ?? null,
      alternatives: candidates.filter((c) => c.score >= 0.24).map((c) => c.ref),
      requiresHumanReview: true,
    };
  });
  return {
    plannerVersion: PLANNER_VERSION,
    results,
    trace,
    autoApproved: 0,
    nextAction: "staff_review",
  };
}

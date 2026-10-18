import { LIMITS } from "./config.js";
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const normalizeText = (s) =>
  String(s || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000b\u000e-\u001f]/g, "")
    .replace(/\r\n?/g, "\n")
    .trim();
export function validateRequirements(items) {
  if (
    !Array.isArray(items) ||
    !items.length ||
    items.length > LIMITS.requirements
  )
    throw Error("Use 1-12 checklist items.");
  const ids = new Set();
  return items.map((r) => {
    if (!/^[a-z][a-z0-9_-]{0,30}$/.test(r.id) || ids.has(r.id))
      throw Error("Checklist IDs must be unique.");
    ids.add(r.id);
    const label = String(r.label || "").trim(),
      query = String(r.query || "").trim();
    if (!label || label.length > 80 || query.length < 8 || query.length > 400)
      throw Error(
        "Each item needs a short label and an 8-400 character description.",
      );
    const maxAgeDays = Number(r.maxAgeDays || 0);
    if (!Number.isInteger(maxAgeDays) || maxAgeDays < 0 || maxAgeDays > 3650)
      throw Error("Age limits must be 0-3650 days.");
    return {
      id: r.id,
      label,
      query,
      required: !!r.required,
      maxAgeDays,
      aliases: Array.isArray(r.aliases)
        ? r.aliases
            .filter((x) => typeof x === "string" && x.length < 40)
            .slice(0, 12)
        : [],
    };
  });
}
export function chunkDocuments(documents) {
  const chunks = [];
  let chars = 0;
  documents.forEach((doc, d) =>
    doc.pages.forEach((page) => {
      chars += page.text.length;
      if (chars > LIMITS.packetChars)
        throw Error(
          "This packet has too much text. Split it into smaller packets.",
        );
      let cursor = 0,
        c = 0;
      while (cursor < page.text.length) {
        let end = Math.min(cursor + 650, page.text.length);
        if (end < page.text.length) {
          const br = page.text.lastIndexOf("\n\n", end);
          if (br > cursor + 100) end = br;
        }
        const raw = page.text.slice(cursor, end),
          leading = raw.length - raw.trimStart().length;
        const text = raw.trim();
        if (text.length > 12)
          chunks.push({
            ref: `d${d}:p${page.number}:c${c++}`,
            docId: doc.id,
            docIndex: d,
            page: page.number,
            start: cursor + leading,
            end: cursor + leading + text.length,
            text,
            ocr: !!page.ocr,
            ocrConfidence: page.confidence ?? null,
            date: doc.date || null,
          });
        if (chunks.length > LIMITS.chunks)
          throw Error(
            "This packet has too many passages. Split it into smaller packets.",
          );
        if (end === page.text.length) break;
        cursor =
          end === page.text.indexOf("\n\n", end)
            ? end + 2
            : Math.max(cursor + 1, end - 80);
      }
    }),
  );
  return chunks;
}
export function dot(a, b) {
  if (a.length !== b.length) throw Error("Embedding dimensions differ.");
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return Math.max(-1, Math.min(1, s));
}
export function absenceMention(text) {
  return /\b(?:not (?:yet )?(?:attached|enclosed|included|received|provided|available)|awaiting|still pending|report pending|results pending|missing (?:report|list|document)|no (?:report|list|document) (?:was |is )?(?:attached|provided|available))\b/i.test(
    text,
  );
}
export function dateIssue(chunk, requirement, now = Date.now()) {
  if (!requirement.maxAgeDays) return false;
  if (!chunk.date || !/^\d{4}-\d{2}-\d{2}$/.test(chunk.date)) return true;
  const t = Date.parse(chunk.date + "T12:00:00Z");
  return (
    !Number.isFinite(t) ||
    new Date(t).toISOString().slice(0, 10) !== chunk.date ||
    t > now + 86400000 ||
    (now - t) / 86400000 > requirement.maxAgeDays
  );
}
export function rankEvidence(
  requirements,
  chunks,
  vectors,
  queryVectors,
  now = Date.now(),
) {
  return requirements.map((r, i) => ({
    id: r.id,
    candidates: chunks
      .map((chunk, j) => ({
        ref: chunk.ref,
        score: Math.round(dot(vectors[j], queryVectors[i]) * 10000) / 10000,
        absence: absenceMention(chunk.text),
        dateIssue: dateIssue(chunk, r, now),
        ocr: chunk.ocr,
        weakOcr:
          chunk.ocr && chunk.ocrConfidence !== null && chunk.ocrConfidence < 70,
      }))
      .sort((a, b) => b.score - a.score)
      .filter(
        (item, n, all) =>
          all.findIndex(
            (x) => x.ref.split(":c")[0] === item.ref.split(":c")[0],
          ) === n,
      )
      .slice(0, 5),
  }));
}
export function citationFor(ref, chunks, documents) {
  const c = chunks.find((x) => x.ref === ref);
  if (!c) return null;
  const doc = documents.find((x) => x.id === c.docId),
    page = doc?.pages.find((x) => x.number === c.page);
  if (!page || page.text.slice(c.start, c.end) !== c.text) return null;
  return { ...c, fileName: doc.name, fileHash: doc.hash, quote: c.text };
}
export function confirmedResults(state) {
  return state.requirements.map((r) => {
    const review = state.reviews[r.id],
      result = state.analysis?.results.find((x) => x.id === r.id);
    const citation = review?.ref
      ? citationFor(review.ref, state.chunks, state.documents)
      : null;
    return {
      requirement: r,
      result,
      review: review && citation ? review : null,
      citation,
    };
  });
}
export function missingRequest(state) {
  const results = confirmedResults(state),
    missing = results.filter((x) => x.requirement.required && !x.review);
  return `DRAFT - staff review required\nReference: ${state.caseLabel || "Referral packet"}\n\nDear referring team,\n\nPlease help us complete the administrative packet by supplying or clarifying:\n${missing.length ? missing.map((x) => "- " + x.requirement.label).join("\n") : "- No outstanding required checklist items after staff review."}\n\nPlease use your practice-approved secure transfer process. This list concerns paperwork only; the receiving clinician determines clinical requirements and urgency.\n\nThank you.`;
}
export function makeReport(state) {
  const results = confirmedResults(state);
  return {
    format: "referralglass-review-v1",
    createdAt: new Date().toISOString(),
    caseReference: state.caseLabel || "Referral packet",
    purpose: "Administrative draft for staff review; not clinical validation.",
    model: state.modelInfo || null,
    planner: state.analysis?.runtime || "not run",
    demo: !!state.demo,
    requirements: results.map(
      ({ requirement: r, review, citation, result }) => ({
        id: r.id,
        label: r.label,
        required: r.required,
        status: review ? "staff-confirmed" : result?.state || "not-searched",
        reviewedAt: review?.at || null,
        evidence: citation
          ? {
              file: citation.fileName,
              sha256: citation.fileHash,
              page: citation.page,
              start: citation.start,
              end: citation.end,
              quote: citation.quote,
              ocr: citation.ocr,
            }
          : null,
      }),
    ),
    missingRequest: missingRequest(state),
  };
}
const words = (s) =>
  (s.toLowerCase().match(/[a-z]+/g) || [])
    .filter(
      (w) =>
        w.length > 2 &&
        ![
          "the",
          "and",
          "for",
          "with",
          "from",
          "patient",
          "record",
          "document",
          "that",
          "this",
          "are",
          "was",
          "has",
          "have",
          "been",
          "into",
        ].includes(w),
    )
    .map((w) => w.replace(/(?:ing|ed|s)$/, ""));
export function lexicalRanking(query, passages) {
  const tokens = passages.map(words),
    df = new Map();
  for (const list of tokens)
    for (const t of new Set(list)) df.set(t, (df.get(t) || 0) + 1);
  const vector = (list) => {
    const v = new Map();
    for (const t of list) v.set(t, (v.get(t) || 0) + 1);
    for (const [t, n] of v)
      v.set(
        t,
        (1 + Math.log(n)) *
          Math.log(1 + (tokens.length + 1) / ((df.get(t) || 0) + 1)),
      );
    return v;
  };
  const q = vector(words(query)),
    cos = (a, b) => {
      let sum = 0,
        aa = 0,
        bb = 0;
      for (const [k, v] of a) {
        aa += v * v;
        sum += v * (b.get(k) || 0);
      }
      for (const v of b.values()) bb += v * v;
      return aa && bb ? sum / Math.sqrt(aa * bb) : 0;
    };
  return passages
    .map((_, index) => ({ index, score: cos(q, vector(tokens[index])) }))
    .sort((a, b) => b.score - a.score);
}

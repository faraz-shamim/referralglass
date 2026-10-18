import "./style.css";
import { DEFAULT_REQUIREMENTS, LIMITS, MODEL } from "./lib/config.js";
import {
  esc,
  validateRequirements,
  chunkDocuments,
  rankEvidence,
  citationFor,
  confirmedResults,
  missingRequest,
  makeReport,
  absenceMention,
  dateIssue,
} from "./lib/core.js";
import { planReview } from "./lib/planner.js";
import { demoDocuments } from "./lib/demo.js";
import { readDocument, sha256, stopOcr, previewPage } from "./lib/documents.js";
import { embedTexts, resetModel } from "./lib/model.js";
import { shell, icon, reportMarkup, aboutMarkup } from "./lib/views.js";
const s = {
  view: "packet",
  documents: [],
  requirements: structuredClone(DEFAULT_REQUIREMENTS),
  caseLabel: "",
  demo: false,
  busy: false,
  progress: "",
  ocr: false,
  useServer: true,
  analysis: null,
  observations: [],
  chunks: [],
  reviews: {},
  trace: [],
  modelInfo: null,
  modelConsent: false,
  selectedRequirement: null,
  selectedRef: null,
};
let operation = 0,
  toastTimer,
  policyDraft = null,
  sourceContext = null,
  returnFocus = null,
  previewUrl = null;
const root = document.querySelector("#app"),
  dialogs = document.querySelector("#dialogs");
const printTarget = document.createElement("div");
printTarget.className = "print-only";
printTarget.id = "print-target";
document.body.append(printTarget);
function render() {
  root.innerHTML = shell(s);
  printTarget.innerHTML = s.documents.length ? reportMarkup(s) : "";
}
function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 6500);
}
function progress(message) {
  s.progress = message;
  const el = document.querySelector("#run-progress");
  if (el) el.textContent = message;
}
function invalidate() {
  s.analysis = null;
  s.observations = [];
  s.reviews = {};
  s.chunks = [];
  s.trace = [];
  s.selectedRef = null;
  s.selectedRequirement = null;
}
function navigate(view) {
  if (!["packet", "evidence", "handoff"].includes(view)) return;
  s.view = view;
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
}
function closeModal() {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  dialogs.innerHTML = "";
  root.inert = false;
  sourceContext = null;
  returnFocus?.focus?.();
}
function modal(title, body, wide = false) {
  if (!dialogs.children.length) returnFocus = document.activeElement;
  root.inert = true;
  dialogs.innerHTML = `<div class="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="dialog-title" class="dialog ${wide ? "wide" : ""}"><header class="dialog-header"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon("close", 18)}</button></header><div class="dialog-body">${body}</div></section></div>`;
  dialogs.querySelector("button,input,textarea,select")?.focus();
}
function download(name, value, type = "application/json") {
  const blob = new Blob(
      [typeof value === "string" ? value : JSON.stringify(value, null, 2)],
      { type },
    ),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function loadDemo(complete = false) {
  if (s.busy) return;
  closeModal();
  invalidate();
  s.documents = demoDocuments(complete);
  for (const d of s.documents)
    d.hash = await sha256(
      new TextEncoder().encode(d.pages.map((p) => p.text).join("\f")),
    );
  s.caseLabel = complete
    ? "DEMO-104 · Complete example"
    : "DEMO-104 · Missing investigations";
  s.demo = true;
  s.view = "packet";
  render();
  toast("Fictional sample loaded. Find evidence to run the real local model.");
}
async function importFiles(files) {
  if (s.busy) return;
  if (!files.length) return;
  if (files.length + s.documents.length > LIMITS.files) {
    toast("A packet can contain at most 12 files.");
    return;
  }
  const job = ++operation;
  invalidate();
  s.demo = false;
  s.busy = true;
  s.progress = "Reading files locally…";
  render();
  let accepted = 0;
  try {
    for (const file of files) {
      if (job !== operation) return;
      try {
        const doc = await readDocument(file, {
          ocr: s.ocr,
          onProgress: (m) =>
            progress(
              m.status +
                (m.progress !== undefined
                  ? " " + Math.round(m.progress * 100) + "%"
                  : ""),
            ),
        });
        if (job !== operation) return;
        if (s.documents.some((d) => d.hash === doc.hash)) {
          toast("That file is already in this packet.");
          continue;
        }
        if (
          s.documents.reduce(
            (n, d) => n + d.pages.reduce((a, p) => a + p.text.length, 0),
            0,
          ) +
            doc.pages.reduce((n, p) => n + p.text.length, 0) >
          LIMITS.packetChars
        )
          throw Error(
            "This packet is too large. Split it into smaller packets.",
          );
        s.documents.push(doc);
        accepted++;
      } catch (e) {
        if (job !== operation) return;
        toast(`${file.name}: ${e.message}`);
      }
    }
  } finally {
    await stopOcr();
    if (job === operation) {
      s.busy = false;
      s.progress = "";
      render();
      if (accepted)
        toast(
          `${accepted} ${accepted === 1 ? "document" : "documents"} read locally. No files were uploaded.`,
        );
    }
  }
}
async function runAnalysis() {
  if (s.busy) return;
  if (!s.documents.length) {
    toast("Add a packet first.");
    return;
  }
  if (!s.modelConsent) {
    modal(
      "Find evidence with local AI",
      `<div class="model-consent-icon">${icon("spark", 31)}</div><p>A small open model will search your documents by meaning, directly in this browser. First use downloads about 50 MB of generic model and runtime assets from Hugging Face and this site.</p><p>Your document text is never sent to the model provider. ${s.useServer ? "The Render planner receives only match scores, page references and quality flags." : "The planner will also run locally."} Every result still needs staff review.</p><p class="small-print">Keep this page open during the first download. A recent desktop browser works best. This is an administrative prototype; use fictional or de-identified records.</p><div class="dialog-actions"><button class="button soft" data-action="close-modal">Cancel</button><button class="button primary" data-action="consent-run">Download and find evidence ${icon("arrow", 16)}</button></div>`,
    );
    return;
  }
  const job = ++operation;
  invalidate();
  s.busy = true;
  s.view = "packet";
  s.progress = "Preparing source-linked passages…";
  render();
  document.querySelector(".run-card")?.scrollIntoView({ block: "center" });
  const start = performance.now();
  try {
    s.requirements = validateRequirements(s.requirements);
    s.chunks = chunkDocuments(s.documents);
    if (!s.chunks.length)
      throw Error(
        "No readable passages were found. Re-import scans with local OCR enabled.",
      );
    const trace = [
      {
        label: "Read source documents",
        detail: `${s.documents.length} files, ${s.documents.reduce((n, d) => n + d.pages.length, 0)} pages. Original files remain on-device.`,
      },
      {
        label: "Index source passages",
        detail: `${s.chunks.length} passages, with file hashes and exact character spans.`,
      },
    ];
    const result = await embedTexts(
      [...s.requirements.map((r) => r.query), ...s.chunks.map((c) => c.text)],
      (m) => {
        if (m.type === "batch")
          progress(`Local AI encoded ${m.done} of ${m.total} texts…`);
        else if (m.status === "progress")
          progress(
            `Downloading ${String(m.file || "model asset")
              .split("/")
              .pop()}${Number.isFinite(m.progress) ? " · " + Math.round(m.progress) + "%" : ""}`,
          );
        else if (m.status === "ready")
          progress("Local model loaded. Searching by meaning…");
        else if (m.status === "initiate")
          progress("Preparing local model assets…");
      },
    );
    if (job !== operation) return;
    s.modelInfo = {
      ...result.model,
      durationMs: result.durationMs,
      passages: s.chunks.length,
      queries: s.requirements.length,
      inferenceLocation: "browser",
    };
    trace.push({
      label: "Encode with the open model",
      detail: `${MODEL.id}; ${s.chunks.length + s.requirements.length} texts; ${MODEL.dimensions}-dimension embeddings on local WASM CPU.`,
      durationMs: result.durationMs,
    });
    const observations = rankEvidence(
      s.requirements,
      s.chunks,
      result.vectors.slice(s.requirements.length),
      result.vectors.slice(0, s.requirements.length),
    );
    s.observations = observations;
    const input = { version: 1, requirements: observations };
    let analysis;
    progress(
      s.useServer
        ? "Asking the stateless planner to audit match scores…"
        : "Auditing match scores locally…",
    );
    const planStart = performance.now();
    if (s.useServer) {
      try {
        const response = await fetch("/api/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw Error("Planner unavailable.");
        analysis = await response.json();
        if (
          analysis.autoApproved !== 0 ||
          analysis.results?.length !== s.requirements.length ||
          analysis.results.some(
            (r) =>
              !s.requirements.some((q) => q.id === r.id) ||
              !r.requiresHumanReview ||
              (r.selectedRef &&
                !citationFor(r.selectedRef, s.chunks, s.documents)),
          )
        )
          throw Error("Planner response could not be verified.");
      } catch {
        analysis = { ...planReview(input), runtime: "local-fallback" };
        toast(
          "Server planner unavailable. The same bounded planner ran on this device.",
        );
      }
    } else analysis = { ...planReview(input), runtime: "on-device" };
    if (job !== operation) return;
    trace.push({
      label:
        analysis.runtime === "render"
          ? "Audit on Render"
          : analysis.runtime === "local-server"
            ? "Audit on development server"
            : "Audit on this device",
      detail:
        "Only references, match scores and quality flags were needed. No document text was sent.",
      durationMs: Math.round(performance.now() - planStart),
    });
    for (const t of analysis.trace)
      trace.push({
        label:
          "Check " +
          s.requirements.find((r) => r.id === t.requirementId)?.label,
        detail: `${t.candidatesExamined} candidates examined; ${t.decision.replaceAll("-", " ")}.`,
      });
    trace.push({
      label: "Wait for staff review",
      detail:
        "Zero automatic approvals. Source passages remain editable only through the original documents.",
    });
    s.analysis = {
      ...analysis,
      totalDurationMs: Math.round(performance.now() - start),
    };
    s.trace = trace;
    s.selectedRequirement = s.requirements[0].id;
    s.selectedRef = analysis.results[0].selectedRef;
    s.view = "evidence";
    s.busy = false;
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
    toast(
      "Evidence located. Review the original sources before confirming each item.",
    );
  } catch (e) {
    if (job === operation) {
      s.busy = false;
      s.analysis = null;
      render();
      toast(e.message);
    }
  }
}
function openSource(docId, number = 1, ref = null) {
  const doc = s.documents.find((d) => d.id === docId),
    page = doc?.pages.find((p) => p.number === Number(number));
  if (!page) return;
  const citation = ref ? citationFor(ref, s.chunks, s.documents) : null;
  let text = esc(
    page.text ||
      "[No readable text. Re-import with scan reading enabled, or inspect the original page.]",
  );
  if (citation && citation.page === page.number)
    text =
      esc(page.text.slice(0, citation.start)) +
      "<mark>" +
      esc(citation.quote) +
      "</mark>" +
      esc(page.text.slice(citation.end));
  modal(
    doc.name,
    `<div class="source-document-meta"><label>Page <select id="source-page-select">${doc.pages.map((p) => `<option value="${p.number}" ${p.number === page.number ? "selected" : ""}>${p.number} of ${doc.pages.length}</option>`).join("")}</select></label><span>${page.ocr ? "OCR · " + page.confidence + "% engine estimate, not clinical confidence" : "Extracted text"}</span><label class="form-field">Document date <input id="document-date" type="date" value="${esc(doc.date || "")}"/></label></div><pre class="source-page-text">${text}</pre>${doc.file ? `<button class="button soft" style="margin-top:15px" data-action="preview-original">${icon("scan", 16)} View original page image</button><div id="source-preview-target"></div>` : ""}<p class="small-print">Source SHA-256: ${esc(doc.hash)}<br/>Date ${doc.dateOrigin === "staff-entered" ? "entered by staff" : "detected only from a “Document date: YYYY-MM-DD” heading; verify it against the source"}. An office age limit is not a clinical validity check.</p>`,
    true,
  );
  sourceContext = { docId, number: page.number, ref };
}
function openPolicy() {
  policyDraft = structuredClone(s.requirements);
  renderPolicy();
}
function renderPolicy() {
  modal(
    "Your office checklist",
    `<p>Describe the paperwork your receiving team requires. These are your office rules, not clinical guidelines. Changing the checklist clears existing findings and confirmations.</p><div id="policy-items">${policyDraft.map((r, i) => `<section class="policy-editor" data-id="${r.id}"><div class="policy-editor-head">ITEM ${String(i + 1).padStart(2, "0")}<button class="icon-button" data-action="remove-policy-item" data-id="${r.id}" aria-label="Remove checklist item ${i + 1}">${icon("close", 16)}</button></div><label class="form-field">Item name<input data-policy-field="label" value="${esc(r.label)}" maxlength="80"/></label><label class="form-field">Describe the evidence to look for<textarea data-policy-field="query" rows="2" maxlength="400">${esc(r.query)}</textarea></label><div class="policy-editor-footer"><label class="check-control"><input data-policy-field="required" type="checkbox" ${r.required ? "checked" : ""}/>Required by this office</label><label class="form-field">Office age limit (days, 0 = none)<input data-policy-field="maxAgeDays" type="number" min="0" max="3650" value="${r.maxAgeDays || 0}"/></label></div></section>`).join("")}</div><button class="text-button" data-action="add-policy-item">${icon("plus", 16)} Add checklist item</button><div class="dialog-actions"><button class="button soft" data-action="reset-policy">Reset example checklist</button><button class="button primary" data-action="save-policy">Save checklist ${icon("check", 16)}</button></div>`,
    true,
  );
}
function capturePolicy() {
  for (const el of dialogs.querySelectorAll(".policy-editor")) {
    const r = policyDraft.find((r) => r.id === el.dataset.id);
    for (const input of el.querySelectorAll("[data-policy-field]"))
      r[input.dataset.policyField] =
        input.type === "checkbox"
          ? input.checked
          : input.type === "number"
            ? Number(input.value)
            : input.value;
  }
}

const actions = {
  "close-modal": closeModal,
  about: () => modal("How ReferralGlass works", aboutMarkup(), true),
  demo: () => loadDemo(false),
  "demo-complete": () => loadDemo(true),
  run: runAnalysis,
  review: () => navigate("evidence"),
  "consent-run": () => {
    s.modelConsent = true;
    closeModal();
    runAnalysis();
  },
  cancel: async () => {
    operation++;
    resetModel();
    await stopOcr();
    s.busy = false;
    s.progress = "";
    render();
    toast("Analysis cancelled. Your files remain in this tab.");
  },
  clear: () =>
    modal(
      "Clear this private workspace?",
      `<p>This removes the documents, extracted text, findings, and confirmations from this page. Save any review you need first. Generic AI and OCR assets may remain cached; patient documents are not saved to those caches.</p><div class="dialog-actions"><button class="button soft" data-action="close-modal">Keep workspace</button><button class="button danger" data-action="confirm-clear">Clear workspace</button></div>`,
    ),
  "confirm-clear": async () => {
    operation++;
    resetModel();
    await stopOcr();
    closeModal();
    invalidate();
    s.documents = [];
    s.caseLabel = "";
    s.demo = false;
    s.modelInfo = null;
    s.view = "packet";
    s.busy = false;
    render();
    toast("Private workspace cleared from this page.");
  },
  "remove-document": ({ id }) => {
    if (s.busy) return;
    s.documents = s.documents.filter((d) => d.id !== id);
    invalidate();
    render();
    toast("Document removed. Findings and confirmations cleared.");
  },
  "open-document": ({ id }) => openSource(id, 1),
  "source-page": (d) => openSource(d.doc, d.page, d.ref),
  "select-requirement": ({ id }) => {
    s.selectedRequirement = id;
    s.selectedRef =
      s.analysis?.results.find((r) => r.id === id)?.selectedRef || null;
    render();
  },
  "select-source": ({ ref }) => {
    s.selectedRef = ref;
    render();
  },
  "preview-original": async () => {
    if (!sourceContext) return;
    const context = { ...sourceContext },
      doc = s.documents.find((d) => d.id === context.docId);
    toast("Rendering the original page locally…");
    const url = await previewPage(doc, context.number);
    if (
      sourceContext?.docId !== context.docId ||
      sourceContext?.number !== context.number
    ) {
      if (url) URL.revokeObjectURL(url);
      return;
    }
    if (!url) {
      toast("This document has no page image. Its original is the text file.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = url;
    const el = document.querySelector("#source-preview-target");
    if (el) {
      el.innerHTML = `<img class="source-preview" src="${url}" alt="Original source page ${context.number}"/>`;
      el.scrollIntoView({ block: "nearest" });
    }
  },
  "manual-source": ({ id }) => {
    s.selectedRequirement = id;
    modal(
      "Choose an original source",
      `<p>Select a passage to inspect. A manual source selection is not a confirmation.</p><div class="manual-source-list">${s.chunks
        .map((c) => {
          const doc = s.documents.find((d) => d.id === c.docId);
          return `<button data-action="manual-pick" data-ref="${c.ref}"><span>${esc(doc.name)} · page ${c.page}<small style="display:block;margin-top:6px;color:#748566">${esc(c.text.slice(0, 100))}…</small></span>${icon("chevron", 16)}</button>`;
        })
        .join("")}</div>`,
      true,
    );
  },
  "manual-pick": ({ ref }) => {
    closeModal();
    s.selectedRef = ref;
    render();
  },
  confirm: ({ id, ref }) => {
    const c = citationFor(ref, s.chunks, s.documents),
      r = s.requirements.find((x) => x.id === id);
    if (!c || !r) {
      toast("The source no longer matches the original. Run the search again.");
      return;
    }
    if (absenceMention(c.quote)) {
      modal(
        "A mention is not the missing document",
        `<p>This passage says that paperwork is absent or pending. It cannot be confirmed as evidence that the paperwork is present. Select another source or include the item in the missing-paperwork request.</p><blockquote class="dialog-quote">${esc(c.quote)}</blockquote><div class="dialog-actions"><button class="button primary" data-action="close-modal">Return to the evidence</button></div>`,
      );
      return;
    }
    if (dateIssue(c, r)) {
      modal(
        "Check the office age limit",
        `<p>This source has no verified date, is future-dated, or falls outside your office’s selected age limit. Inspect the original page and its date, or edit the office policy if appropriate. This is an administrative flag, not a clinical validity judgment.</p><div class="dialog-actions"><button class="button soft" data-action="close-modal">Return</button><button class="button primary" data-action="source-page" data-doc="${c.docId}" data-page="${c.page}" data-ref="${c.ref}">Inspect source page</button></div>`,
      );
      return;
    }
    modal(
      "Confirm the original source",
      `<p><strong>${esc(r.label)}</strong><br/>${esc(c.fileName)} · page ${c.page}</p><blockquote class="dialog-quote">${esc(c.quote)}</blockquote><label class="check-control confirm-control"><input id="confirmation-ack" type="checkbox"/><span>I inspected the original source, checked that it belongs to this referral packet, and confirmed that the quoted text meets this office’s paperwork requirement. I understand this is not clinical approval.</span></label><div class="dialog-actions"><button class="button soft" data-action="close-modal">Keep reviewing</button><button id="confirm-source-button" class="button primary" data-action="save-confirmation" data-id="${id}" data-ref="${ref}" disabled>Confirm source ${icon("check", 16)}</button></div>`,
    );
  },
  "save-confirmation": ({ id, ref }) => {
    if (!document.querySelector("#confirmation-ack")?.checked) return;
    const c = citationFor(ref, s.chunks, s.documents);
    if (
      !c ||
      absenceMention(c.quote) ||
      dateIssue(
        c,
        s.requirements.find((r) => r.id === id),
      )
    ) {
      toast("The source cannot be confirmed. Inspect it again.");
      return;
    }
    s.reviews[id] = { ref, at: new Date().toISOString(), fileHash: c.fileHash };
    closeModal();
    render();
    toast("Source confirmed by staff. No clinical approval is implied.");
  },
  policy: openPolicy,
  "add-policy-item": () => {
    capturePolicy();
    if (policyDraft.length >= LIMITS.requirements) {
      toast("Use at most 12 checklist items.");
      return;
    }
    policyDraft.push({
      id: "r_" + crypto.randomUUID().slice(0, 12),
      label: "",
      query: "",
      required: true,
      maxAgeDays: 0,
      aliases: [],
    });
    renderPolicy();
  },
  "remove-policy-item": ({ id }) => {
    capturePolicy();
    if (policyDraft.length === 1) {
      toast("Keep at least one checklist item.");
      return;
    }
    policyDraft = policyDraft.filter((r) => r.id !== id);
    renderPolicy();
  },
  "reset-policy": () => {
    policyDraft = structuredClone(DEFAULT_REQUIREMENTS);
    renderPolicy();
  },
  "save-policy": () => {
    capturePolicy();
    s.requirements = validateRequirements(policyDraft);
    invalidate();
    closeModal();
    render();
    toast("Checklist saved. Run a new search to use the updated office rules.");
  },
  "export-policy": () =>
    download("referralglass-office-checklist.json", {
      format: "referralglass-checklist-v1",
      requirements: s.requirements,
    }),
  "export-report": () => {
    if (!s.documents.length) return;
    download(
      "referralglass-review-" + new Date().toISOString().slice(0, 10) + ".json",
      makeReport(s),
    );
    toast(
      "Review saved locally. It contains source excerpts; use an approved secure channel.",
    );
  },
  "copy-request": async () => {
    const text = missingRequest(s);
    try {
      await navigator.clipboard.writeText(text);
      toast("Draft copied. Review before using your approved secure channel.");
    } catch {
      modal(
        "Copy the missing-paperwork request",
        `<textarea rows="16" style="width:100%" readonly>${esc(text)}</textarea><p class="small-print">Clipboard access was unavailable. Select and copy this draft manually.</p>`,
      );
    }
  },
  print: () => {
    if (!s.documents.length) return;
    printTarget.innerHTML = reportMarkup(s);
    window.print();
  },
};
document.addEventListener("click", async (e) => {
  const target = e.target.closest("[data-action],[data-view]");
  if (target && target.disabled) return;
  if (target?.dataset.view) {
    e.preventDefault();
    navigate(target.dataset.view);
    return;
  }
  if (target?.dataset.action) {
    e.preventDefault();
    try {
      await actions[target.dataset.action]?.(target.dataset);
    } catch (error) {
      toast(error.message || "That action could not finish.");
    }
    return;
  }
  if (e.target.classList.contains("modal-backdrop")) closeModal();
});
document.addEventListener("change", async (e) => {
  const el = e.target;
  try {
    if (el.id === "file-input") await importFiles([...el.files]);
    else if (el.id === "ocr-option") s.ocr = el.checked;
    else if (el.id === "server-option") s.useServer = el.checked;
    else if (el.id === "case-reference") {
      s.caseLabel = el.value.trim().slice(0, 60);
      printTarget.innerHTML = reportMarkup(s);
    } else if (el.id === "confirmation-ack") {
      document.querySelector("#confirm-source-button").disabled = !el.checked;
    } else if (el.id === "source-page-select" && sourceContext) {
      const c = { ...sourceContext };
      openSource(c.docId, Number(el.value), c.ref);
    } else if (el.id === "document-date" && sourceContext) {
      const d = s.documents.find((d) => d.id === sourceContext.docId);
      d.date = el.value || null;
      d.dateOrigin = "staff-entered";
      invalidate();
      closeModal();
      render();
      toast(
        "Document date updated. Rerun the search to check office age limits.",
      );
    } else if (el.id === "policy-input" && el.files[0]) {
      if (el.files[0].size > 50000) throw Error("Checklist file is too large.");
      const parsed = JSON.parse(await el.files[0].text());
      if (parsed.format !== "referralglass-checklist-v1")
        throw Error("This is not a ReferralGlass checklist.");
      s.requirements = validateRequirements(parsed.requirements).map(
        (r, i) => ({ ...r, id: "item_" + i }),
      );
      invalidate();
      render();
      toast("Office checklist loaded. Run a fresh search.");
    }
  } catch (error) {
    toast(error.message || "The file could not be read.");
  }
});
document.addEventListener("dragover", (e) => {
  if (e.target.closest("#dropzone")) {
    e.preventDefault();
    document.querySelector("#dropzone")?.classList.add("over");
  }
});
document.addEventListener("dragleave", (e) => {
  if (e.target.closest("#dropzone"))
    document.querySelector("#dropzone")?.classList.remove("over");
});
document.addEventListener("drop", (e) => {
  if (e.target.closest("#dropzone")) {
    e.preventDefault();
    document.querySelector("#dropzone")?.classList.remove("over");
    importFiles([...e.dataTransfer.files]);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && dialogs.children.length) {
    closeModal();
    return;
  }
  if (e.key === "Tab" && dialogs.children.length) {
    const fields = [
      ...dialogs.querySelectorAll(
        "button:not([disabled]),a[href],input:not([disabled]),textarea,select",
      ),
    ].filter((el) => el.offsetParent !== null);
    const first = fields[0],
      last = fields.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
});
render();
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker.register("/sw.js").catch(() => {});

import {
  esc,
  confirmedResults,
  missingRequest,
  makeReport,
  citationFor,
} from "./core.js";
import { MODEL, POLICY_NOTE } from "./config.js";
const paths = {
  file: "M6 3h8l4 4v14H6z M14 3v5h5 M9 12h6 M9 16h6",
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  check: "m5 12 4 4 10-10",
  search: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z m5-2 5 5",
  arrow: "M4 12h15 m-6-6 6 6-6 6",
  upload: "M12 16V3 m-5 5 5-5 5 5 M4 15v6h16v-6",
  plus: "M12 4v16 M4 12h16",
  chevron: "m9 5 7 7-7 7",
  close: "m6 6 12 12 M6 18 18 6",
  shield: "m12 3 8 3v7c0 5-8 9-8 9s-8-4-8-9V6z m-4 9 3 3 5-6",
  settings: "M4 6h16 M4 12h16 M4 18h16 M9 3v6 M16 9v6 M8 15v6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l4 2",
  download: "M12 3v13 m-5-5 5 5 5-5 M4 16v5h16v-5",
  copy: "M8 8h13v13H8z M16 4V1H1v15h3",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v6 M12 7v1",
  scan: "M3 8V3h5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M3 12h18",
  trash: "M3 6h18 M8 6V3h8v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7",
  spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
  layers: "m12 2 10 5-10 5L2 7z m-10 5 10 5 10-5 m-20 5 10 5 10-5",
  mail: "M3 5h18v14H3z m0 0 9 7 9-7",
  link: "m10 14 4-4 M8 16l-2 2a4 4 0 0 1-6-6l4-4 M16 8l2-2a4 4 0 0 1 6 6l-4 4",
};
export const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
export function shell(s) {
  const reviewed = confirmedResults(s).filter(
      (x) => x.review && x.requirement.required,
    ).length,
    total = s.requirements.filter((r) => r.required).length;
  return `<aside class="rail"><a class="brand" href="/" aria-label="ReferralGlass home"><img src="/icon.svg" alt=""/><span>Referral<span class="brand-light">Glass</span></span></a><p class="rail-label">YOUR WORKSPACE</p><nav aria-label="Main navigation">${[
    ["packet", "layers", "Packet desk"],
    ["evidence", "search", "Evidence review"],
    ["handoff", "mail", "Handoff draft"],
  ]
    .map(
      ([v, i, t]) =>
        `<button class="nav-button ${s.view === v ? "active" : ""}" data-view="${v}" ${s.view === v ? 'aria-current="page"' : ""}>${icon(i)}<span>${t}</span>${v === "packet" && s.documents.length ? `<b>${s.documents.length}</b>` : ""}${v === "evidence" && s.analysis ? '<span class="tiny-dot"></span>' : ""}</button>`,
    )
    .join(
      "",
    )}</nav><div class="rail-bottom"><div class="privacy-seal">${icon("shield", 22)}<div><strong>Document text stays here.</strong><p>Local AI. Visible evidence.</p></div></div><button class="nav-button" data-action="about">${icon("info")}<span>How it works</span></button><a class="nav-link" href="https://github.com/faraz-shamim/referralglass" target="_blank" rel="noopener">Open-source project ${icon("arrow", 15)}</a></div></aside>
 <div class="workspace"><header class="topbar"><div class="breadcrumb">Workspace ${icon("chevron", 13)} <strong>${s.demo ? "Demo packet" : s.documents.length ? "Private packet" : "New packet"}</strong></div><div class="topbar-right"><span class="local-dot"></span><span>Text stays on device</span><button class="icon-button" data-action="about" aria-label="Privacy and model information">${icon("shield", 18)}</button></div></header>
 <main id="main"><div class="demo-note">${icon("info", 15)} Challenge prototype. Use fictional or de-identified documents. Staff review is always required.</div>${s.view === "packet" ? packetView(s) : s.view === "evidence" ? evidenceView(s) : handoffView(s)}</main>
 <footer class="workspace-footer"><span>Evidence supports a decision. People make it.</span><a href="/lab.html">Retrieval lab ${icon("arrow", 13)}</a></footer></div><nav class="mobile-nav" aria-label="Mobile navigation">${[
   ["packet", "layers", "Packet"],
   ["evidence", "search", "Review"],
   ["handoff", "mail", "Handoff"],
 ]
   .map(
     ([v, i, t]) =>
       `<button data-view="${v}" class="${s.view === v ? "active" : ""}">${icon(i, 18)}<span>${t}</span></button>`,
   )
   .join("")}</nav>`;
}
function packetView(s) {
  const pages = s.documents.reduce((n, d) => n + d.pages.length, 0),
    scans = s.documents
      .flatMap((d) => d.pages)
      .filter((p) => p.needsOcr).length;
  return `<div class="page-heading"><div><span class="eyebrow">A LITTLE CLARITY, BEFORE THE HANDOFF</span><h1>Every detail,<br/><em>in view.</em></h1><p class="heading-copy">Turn a stack of referral paperwork into a clear,<br class="desktop-br"/> source-linked checklist. Keep the judgment human.</p></div><div class="heading-art" aria-hidden="true"><div class="art-card back"></div><div class="art-card mid"></div><div class="art-card front"><span class="art-folder">${icon("file", 28)} REFERRAL PACKET</span><span class="art-line wide"></span><span class="art-line"></span><span class="art-line short"></span><div class="art-evidence">${icon("check", 16)} Source found<span>page 02</span></div><span class="art-line"></span><span class="art-line wide"></span></div><div class="art-seal">${icon("shield", 24)}</div><span class="art-caption">A clearer view. A more thoughtful handoff.</span></div></div>
 <div class="section-top"><div><h2>Your packet desk</h2><p>Start with a sample, or add your own documents.</p></div><div class="button-row"><button class="button soft" data-action="demo" ${s.busy ? "disabled" : ""}>${icon("spark", 17)} Try a sample packet</button>${s.documents.length ? `<button class="icon-button danger" data-action="clear" aria-label="Clear private workspace" ${s.busy ? "disabled" : ""}>${icon("trash", 18)}</button>` : ""}</div></div>
 <div class="desk-grid"><section class="card packet-card"><div class="card-head"><div class="card-title">${icon("layers", 18)}<h3>Documents</h3></div><span class="count-chip">${s.documents.length} files · ${pages} pages</span></div>
 <label id="dropzone" class="dropzone ${s.busy ? "disabled" : ""}"><input id="file-input" type="file" multiple accept=".pdf,.txt,.md,image/png,image/jpeg,image/webp" ${s.busy ? "disabled" : ""}/><span class="upload-symbol">${icon("upload", 24)}</span><strong>Drop paperwork here</strong><span>or <u>browse your files</u></span><small>PDF, TXT, MD, or scanned images · 10 MB per file</small></label><label class="check-control ocr-control"><input id="ocr-option" type="checkbox" ${s.ocr ? "checked" : ""} ${s.busy ? "disabled" : ""}/><span>Read scans with local English OCR <small>OCR assets download on first scan. Nothing is uploaded.</small></span></label>
 <a class="text-button" style="margin:0 22px 15px" href="/samples/referral-cover.pdf" download>Download a fictional sample PDF ${icon("download", 14)}</a><div class="document-list">${s.documents.length ? s.documents.map((d) => `<article class="document-row"><span class="file-symbol">${icon(d.pages.some((p) => p.ocr) ? "scan" : "file", 20)}</span><div class="file-details"><strong>${esc(d.name)}</strong><span>${d.pages.length} ${d.pages.length === 1 ? "page" : "pages"} · ${d.demo ? "Fictional sample" : d.pages.some((p) => p.ocr) ? "OCR - verify against scan" : "Extracted locally"} ${d.date ? "· " + esc(d.date) : ""}</span></div><button class="icon-button" data-action="open-document" data-id="${esc(d.id)}" aria-label="Read ${esc(d.name)}">${icon("search", 17)}</button><button class="icon-button" data-action="remove-document" data-id="${esc(d.id)}" aria-label="Remove ${esc(d.name)}" ${s.busy ? "disabled" : ""}>${icon("close", 16)}</button></article>`).join("") : `<div class="empty-documents"><p>A place for the paperwork.<br/><span>No files have been added yet.</span></p></div>`}</div>${scans ? `<div class="notice amber">${icon("scan", 17)}<span>${scans} ${scans === 1 ? "page has" : "pages have"} little or no readable text. Re-import with scan reading enabled, or review manually.</span></div>` : ""}
 ${s.documents.length ? `<label class="case-field">Office reference <input id="case-reference" maxlength="60" value="${esc(s.caseLabel)}" placeholder="An office reference, rather than a patient name"/></label>${s.demo ? '<button class="text-button" style="margin:0 21px 15px" data-action="demo-complete">Load complete sample packet</button>' : ""}` : ""}
 </section>
 <section class="card checklist-card"><div class="card-head"><div class="card-title">${icon("check", 18)}<h3>Office checklist</h3></div><button class="text-button" data-action="policy" ${s.busy ? "disabled" : ""}>Edit checklist ${icon("settings", 15)}</button></div><p class="card-intro">What does your receiving team need to see?</p><ol class="policy-list">${s.requirements.map((r, i) => `<li><span class="requirement-number">${String(i + 1).padStart(2, "0")}</span><div><strong>${esc(r.label)}</strong><small>${r.required ? "Required" : "Optional"}${r.maxAgeDays ? " · " + r.maxAgeDays + "-day office age limit" : ""}</small></div><span class="outline-dot"></span></li>`).join("")}</ol><p class="policy-note">${POLICY_NOTE}</p><div class="checklist-tools"><button class="text-button" data-action="export-policy">${icon("download", 15)} Save checklist</button><label class="text-button import-label">${icon("upload", 15)} Load checklist<input id="policy-input" type="file" accept="application/json,.json" hidden/></label></div></section></div>
 <section class="run-card"><div class="run-icon">${icon("spark", 24)}</div><div class="run-copy"><h3>${s.busy ? "A closer look at your paperwork…" : s.analysis ? "Your evidence is ready to review." : "Let the local AI find the relevant passages."}</h3><p id="run-progress">${s.busy ? esc(s.progress || "Starting local analysis…") : s.analysis ? "Check each source before confirming an item. No item is approved automatically." : "A compact open model searches by meaning, then a bounded planner flags gaps and uncertain matches."}</p><label class="check-control planner-choice"><input id="server-option" type="checkbox" ${s.useServer ? "checked" : ""} ${s.busy ? "disabled" : ""}/><span>Use the Render planner <small>Shares anonymous match scores and page references; never document text. Uncheck for a fully local review.</small></span></label></div>${s.busy ? `<button class="button soft" data-action="cancel">Cancel</button>` : `<button class="button primary" data-action="${s.analysis ? "review" : "run"}" ${!s.documents.length ? "disabled" : ""}>${icon(s.analysis ? "arrow" : "search", 18)} ${s.analysis ? "Review evidence" : "Find evidence"}</button>`}</section>
 <div class="desk-footnotes"><span>${icon("shield", 15)} No account. No document uploads.</span><span>${icon("file", 15)} Exact passages, linked to source pages.</span><span>${icon("check", 15)} Staff stays in control.</span></div>`;
}
const stateLabels = {
  review: "Candidate found",
  conflict: "Needs a closer look",
  ambiguous: "Multiple possible sources",
  "not-found": "Not located",
};
function evidenceView(s) {
  if (!s.analysis)
    return `<div class="page-heading compact"><div><span class="eyebrow">THE EVIDENCE, IN CONTEXT</span><h1>Start with the source.</h1><p class="heading-copy">Add a packet and run a local search to see source-linked evidence here.</p><button class="button primary" data-view="packet">${icon("layers", 18)} Open the packet desk</button></div></div><div class="large-empty">${icon("search", 48)}<h2>Every result needs a source.</h2><p>Your checklist and evidence will appear here after analysis.</p></div>`;
  const rows = confirmedResults(s),
    confirmed = rows.filter((x) => x.review && x.requirement.required).length,
    total = s.requirements.filter((r) => r.required).length;
  const selected =
    rows.find((x) => x.requirement.id === s.selectedRequirement) || rows[0];
  const result = selected?.result,
    ref = s.selectedRef || result?.selectedRef,
    citation = citationFor(ref, s.chunks, s.documents);
  const doc = citation
      ? s.documents.find((d) => d.id === citation.docId)
      : null,
    page = doc?.pages.find((p) => p.number === citation.page);
  return `<div class="review-heading"><div><span class="eyebrow">THE EVIDENCE, IN CONTEXT</span><h1>Review, then confirm.</h1><p>Similarity finds a passage. Staff decides whether it meets the office requirement.</p></div><button class="button primary" data-view="handoff">Prepare handoff ${icon("arrow", 17)}</button></div><div class="review-summary"><div class="summary-count"><b>${confirmed}<span>/${total}</span></b><div><strong>Required items confirmed by staff</strong><span>${total - confirmed} still need attention · this is paperwork review, not clinical clearance.</span></div></div><span class="model-pill">${icon("spark", 14)} MiniLM · local CPU</span></div>
 <div class="evidence-grid"><section class="card findings-panel"><div class="card-head"><h3>Checklist findings</h3><span class="count-chip">${s.requirements.length} items</span></div>${rows.map(({ requirement: r, result: a, review }) => `<button class="finding ${r.id === selected.requirement.id ? "selected" : ""} ${review ? "confirmed" : ""}" data-action="select-requirement" data-id="${r.id}"><span class="finding-icon">${icon(review ? "check" : a?.state === "not-found" ? "search" : "file", 18)}</span><span><strong>${esc(r.label)}</strong><small>${review ? "Staff confirmed" : stateLabels[a?.state] || "Not searched"}</small></span>${icon("chevron", 15)}</button>`).join("")}<div class="findings-bottom">${icon("shield", 15)} Auto-approved: 0. Always.</div></section>
 <section class="card source-panel"><div class="card-head"><div class="card-title">${icon("link", 17)}<h3>${esc(selected.requirement.label)}</h3></div><span class="status-pill ${selected.review ? "good" : result?.state === "review" ? "sage" : "amber"}">${selected.review ? "Staff confirmed" : stateLabels[result?.state] || "Not searched"}</span></div><div class="source-content"><p class="requirement-query">${esc(selected.requirement.query)}</p><p class="finding-reason">${esc(result?.reason || "No source located.")}</p>
 ${
   citation
     ? `<div class="source-meta"><div>${icon(citation.ocr ? "scan" : "file", 18)}<span><strong>${esc(citation.fileName)}</strong><small>Page ${citation.page}${citation.ocr ? " · OCR text - verify original scan" : ""}</small></span></div><span class="similarity" title="Cosine similarity, not clinical confidence.">Cosine ${(s.observations.find((o) => o.id === selected.requirement.id)?.candidates.find((c) => c.ref === citation.ref)?.score || 0).toFixed(2)}</span></div><div class="evidence-quote"><span class="quote-label">EXACT EXTRACTED PASSAGE</span><blockquote>${esc(citation.quote)}</blockquote></div>
 <div class="source-actions"><button class="button soft" data-action="source-page" data-doc="${esc(citation.docId)}" data-page="${citation.page}" data-ref="${citation.ref}">${icon("file", 16)} Open source page</button><button class="button ${selected.review ? "soft" : "primary"}" data-action="confirm" data-id="${selected.requirement.id}" data-ref="${citation.ref}">${icon("check", 16)} ${selected.review ? "Change confirmation" : "Confirm this source"}</button></div><p class="small-print">Confirm only after inspecting the source and your practice’s requirements. This does not validate clinical content.</p>`
     : `<div class="missing-evidence">${icon("search", 35)}<h3>No reliable passage located</h3><p>Check the original documents. You can add missing paperwork or select a source manually.</p><button class="button soft" data-action="manual-source" data-id="${selected.requirement.id}">Choose a source page</button></div>`
 }
 <button class="text-button" data-action="manual-source" data-id="${selected.requirement.id}" style="margin-top:17px">Choose a source manually ${icon("arrow", 14)}</button>${
   result?.alternatives?.length
     ? `<details class="alternatives"><summary>Other candidate sources (${result.alternatives.length})</summary>${result.alternatives
         .map((id) => {
           const c = citationFor(id, s.chunks, s.documents);
           return c
             ? `<button class="alternative" data-action="select-source" data-ref="${id}"><span>${esc(c.fileName)} · p.${c.page}</span>${icon("chevron", 14)}</button>`
             : "";
         })
         .join("")}</details>`
     : ""
 }</div></section></div>
 <details class="card trace-panel"><summary>${icon("layers", 17)} Activity record <span>${s.analysis.runtime === "render" ? "Render planner" : s.analysis.runtime === "local-server" ? "Development server planner" : "On-device planner"} · ${s.modelInfo?.durationMs ? (s.modelInfo.durationMs / 1000).toFixed(1) + "s local AI" : ""}</span></summary><ol>${s.trace.map((t) => `<li><span class="trace-dot"></span><div><strong>${esc(t.label)}</strong><small>${esc(t.detail)}</small></div><span>${t.durationMs === undefined ? "" : t.durationMs + " ms"}</span></li>`).join("")}</ol><p class="small-print">An action log, not a claim that a clinician reviewed the packet. Documents are held in this tab only.</p></details>`;
}
export function reportMarkup(s) {
  const report = makeReport(s),
    confirmed = report.requirements.filter(
      (r) => r.required && r.status === "staff-confirmed",
    ).length,
    total = report.requirements.filter((r) => r.required).length;
  return `<article class="report-page"><div class="report-brand"><img src="/icon.svg" alt=""/>ReferralGlass <span>ADMINISTRATIVE REVIEW DRAFT</span></div><h1>Referral packet review</h1><div class="report-meta"><span><b>Office reference</b>${esc(report.caseReference)}</span><span><b>Prepared</b>${new Date(report.createdAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}</span><span><b>Staff confirmed</b>${confirmed} / ${total} required</span></div>${s.demo ? '<p class="report-demo">FICTIONAL DEMONSTRATION PACKET - NOT A REAL PATIENT</p>' : ""}<p class="report-disclaimer">Administrative preflight only. This draft does not determine clinical suitability, urgency, diagnosis, treatment, or completeness of care. Staff must apply the receiving practice’s requirements.</p>${report.requirements.map((r) => `<section class="report-item"><div><h3>${esc(r.label)}</h3><b class="report-status">${r.status === "staff-confirmed" ? "STAFF CONFIRMED" : "NEEDS STAFF ATTENTION"}</b></div>${r.evidence ? `<p class="report-citation">${esc(r.evidence.file)} · page ${r.evidence.page}</p><blockquote>${esc(r.evidence.quote)}</blockquote><p class="report-hash">Source SHA-256: ${esc(r.evidence.sha256)}</p>` : "<p>No source has been confirmed for this checklist item.</p>"}</section>`).join("")}<p class="report-footer">Local semantic retrieval: ${MODEL.id} (${MODEL.revision.slice(0, 12)}). Quotes refer to extracted text; OCR can contain errors. Original documents are not included in this draft.</p></article>`;
}
function handoffView(s) {
  if (!s.documents.length)
    return `<div class="page-heading compact"><div><span class="eyebrow">A THOUGHTFUL HANDOFF</span><h1>Keep the next step clear.</h1><p class="heading-copy">Your reviewed checklist and missing-paperwork request will appear here.</p><button class="button primary" data-view="packet">Open the packet desk ${icon("arrow", 17)}</button></div></div>`;
  return `<div class="review-heading"><div><span class="eyebrow">A THOUGHTFUL HANDOFF</span><h1>Ready for the next pair of eyes.</h1><p>Export a draft for your approved office workflow. Nothing is sent automatically.</p></div><div class="button-row"><button class="button soft" data-action="export-report">${icon("download", 17)} Save review JSON</button><button class="button primary" data-action="print">${icon("file", 17)} Print / save PDF</button></div></div><div class="handoff-grid"><section class="card request-card"><div class="card-head"><div class="card-title">${icon("mail", 18)}<h3>Request missing paperwork</h3></div><button class="text-button" data-action="copy-request">${icon("copy", 15)} Copy draft</button></div><pre class="request-draft">${esc(missingRequest(s))}</pre><div class="notice">${icon("shield", 17)}<span>Review before sharing. Exported reports contain document excerpts; use an approved secure channel.</span></div></section><section class="card export-card"><span class="export-symbol">${icon("file", 32)}</span><h3>A record you can inspect.</h3><p>The export includes each staff-confirmed passage, source page, original file hash, and review status.</p><ul><li>Original files stay in this tab</li><li>No clinical approval is implied</li><li>Unconfirmed items stay visible</li></ul><button class="text-button" data-view="evidence">Return to evidence ${icon("arrow", 15)}</button></section></div><h2 class="preview-heading">Review draft preview</h2>${reportMarkup(s)}`;
}
export function aboutMarkup() {
  return `<div class="about-intro">${icon("shield", 34)}<h3>A clearer handoff, with a smaller data footprint.</h3><p>ReferralGlass helps office staff locate paperwork. It does not make clinical decisions.</p></div><div class="about-section"><h4>What stays on this device</h4><p>Original files, extracted text, OCR images, source quotations, and your confirmations stay in this tab. The working session is held in memory. Use Clear workspace to remove it from this page. Exports contain excerpts, so handle them with care.</p></div><div class="about-section"><h4>What the Render planner receives</h4><p>When enabled, the stateless planner receives anonymous document/page references, similarity scores, and quality flags. It receives no names, filenames, document text, images, or clinical notes. It stores no review sessions. Hosting providers can see normal connection metadata. Turn the option off to plan entirely on-device.</p></div><div class="about-section"><h4>An open model, running locally</h4><p><a href="https://huggingface.co/${MODEL.id}" target="_blank" rel="noopener">${MODEL.id}</a> runs on your browser’s CPU through Transformers.js. First use downloads about 50 MB of model and runtime assets. Hugging Face serves the weights and can see ordinary download connection metadata; it receives no document text. Cached assets can work offline.</p><code>Revision ${MODEL.revision}</code><p>English scan reading uses Tesseract locally. OCR and semantic similarity can be wrong. Every item needs staff review.</p></div><div class="about-section"><h4>Built for an independent practice</h4><p>The buyer hypothesis is a small practice that pays for private packet preparation, reusable checklists, and support. A $29/month hosted offering is an unvalidated pricing hypothesis, not an active paid plan. This free challenge prototype has no paying clinic or clinical validation.</p><p><a href="https://github.com/faraz-shamim/referralglass" target="_blank" rel="noopener">Source and self-hosting guide</a> · <a href="/lab.html">Reproducible retrieval lab</a></p></div>`;
}

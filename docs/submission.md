---
title: "ReferralGlass: An AI Referral Desk That Shows Its Work"
published: false
tags: devchallenge, hf26challenge, ai, healthcare
cover_image: https://raw.githubusercontent.com/faraz-shamim/referralglass/main/web/public/art/referralglass-cover.webp
description: "A local AI referral-packet desk with exact source pages, human confirmations, and a stateless Render planner."
---

_This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12)._

“**The imaging report is still pending.**”

Put that sentence inside a referral packet and a semantic search for _investigation reports_ will find a convincing match. The office still needs the actual report.

That small distinction became the center of **ReferralGlass**, a medical-office paperwork agent I built for this week's challenge. It finds relevant passages, opens their source pages, and asks a person to decide whether the requested paperwork is actually there. Every checklist begins with **zero automatic approvals**.

## What I Built

ReferralGlass is a referral-packet desk for a small independent practice. Its intended user is the coordinator preparing documents for a receiving specialist office: several files, an office-specific checklist, and a handoff that another person needs to understand.

The workflow is deliberately concrete:

- Import PDFs, text files, or scans. PDF extraction and English OCR run locally.
- Describe the receiving office's paperwork requirements, including optional age limits.
- Run a small open model in the browser to locate candidate passages.
- Inspect the exact extracted quote, file, page, and original page image.
- Confirm each source manually, then export a review or draft a request for missing paperwork.

[AHRQ's referral guidance](https://www.ahrq.gov/health-literacy/improve/precautions/tool21.html) provided useful background on organizing a referral and its relevant information. The six bundled checklist items are illustrative office rules, not an official clinical checklist.

**The buyer hypothesis:** an independent practice could pay for reusable checklists, private packet preparation, consistent handoffs, and support. I would test **$29/month per office** as a starting price. That is an unvalidated hypothesis: there is no active subscription, paying customer, clinic pilot, or measured time-saving claim.

The first validation step would be a consented pilot with de-identified packets, measuring staff time, missed paperwork, corrections, and willingness to pay. The prototype provides a working workflow to evaluate before making those promises.

## Demo

### [Open ReferralGlass →](https://referralglass.onrender.com/)

The live version runs on Render's free web-service plan. It may take a little time to wake after inactivity. A recent desktop browser works best for the first model download; the interface also fits a phone.

![ReferralGlass packet desk with file import, a customizable office checklist, and local AI controls](https://raw.githubusercontent.com/faraz-shamim/referralglass/main/docs/referralglass-desktop.png)

**Try the missing-report scenario:**

1. Choose **Try a sample packet**. The four fictional files contain six pages.
2. Choose **Find evidence** and allow the one-time generic model download. No account or inference key is required.
3. Open **Investigation reports**. The closest passage explicitly says the report is pending. Attempting to confirm it opens an explanation and leaves the item outstanding.
4. Inspect the other source pages and confirm them. Each confirmation requires an acknowledgement that the passage belongs to this packet and meets this office's requirement.
5. Open **Prepare handoff**. The missing-paperwork request follows the staff decisions. Save the source-linked JSON or print/save a PDF locally.

![Real evidence review showing exact extracted passages and source-page controls](https://raw.githubusercontent.com/faraz-shamim/referralglass/main/docs/referralglass-evidence.png)

The original-page viewer makes extraction checkable. The bundled two-page sample PDF also gives you a safe way to try real PDF import and scan reading. Every example is explicitly fictional.

![A fictional PDF rendered locally in the original source-page viewer](https://raw.githubusercontent.com/faraz-shamim/referralglass/main/docs/referralglass-source.png)

There is a complete-packet example too, along with manual source selection, checklist import/export, and an activity record. Changing files, dates, or the checklist clears earlier findings and confirmations so stale decisions do not silently survive an edit.

## Code

[Source, setup instructions, tests, licenses and measured reports on GitHub](https://github.com/faraz-shamim/referralglass)

```sh
npm ci --ignore-scripts
npm run dev
```

The application is MIT-licensed. The open model and supporting engines retain their own licenses, which are documented and distributed with the runtime.

## How I Built It

### A compact model, close to the documents

The model is [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2), pinned to revision `751bff37182d3f1213fa05d7196b954e230abad9`. Transformers.js runs its quantized weights through ONNX Runtime Web on WASM CPU. It produces normalized 384-dimensional embeddings for the office's requirements and the source passages.

The index preserves a document reference, page number, exact character range, and SHA-256 of the source file. Clicking a citation resolves the passage against the current extracted text. A changed passage cannot become a valid citation. For PDFs and OCR, “exact” means the extracted text: the original page remains available because extraction can be wrong.

The agent then runs a bounded plan: inspect ranked candidates, flag uncertainty or quality problems, present the sources, and wait for staff. It does not generate a clinical summary. The missing-paperwork message is assembled from the unconfirmed required checklist items, so it stays tied to the review state.

### The Render boundary

**Render hosts the agent frontend, the stateless review planner, and the compressed PDF/OCR/inference runtime assets.** Keeping the language model on the user's device lets the server operate within a small free instance while avoiding a document-upload workflow.

The planner request contains only a short internal requirement ID and candidates like this:

```json
{
  "ref": "d0:p1:c0",
  "score": 0.5134,
  "absence": false,
  "dateIssue": false,
  "ocr": false,
  "weakOcr": false
}
```

No names, filenames, document text, checklist descriptions, images, or source quotes are needed. Imported checklist IDs are replaced with internal IDs before use. The API rejects unknown fields and unbounded inputs; there is no upload endpoint, session database, or application request-body logging.

A raw cosine score describes similarity, not confidence that an office requirement has been met. Closely competing sources, explicit missing-document language, low OCR quality, and office date limits remain visible. Those heuristics are illustrative and can fail; source inspection is essential.

Every response records `autoApproved: 0` and `nextAction: "staff_review"`. A visible activity record shows the steps. If Render is waking or unavailable, the same planner runs locally. You can also turn off the server planner yourself.

### What the real tests caught

The first browser run revealed that the inference runtime tried loading an external JavaScript module that the site's content policy blocked. I self-hosted the exact matching runtime and compressed its large WASM binary; its gzip transfer is about 6.8 MB.

Later, visiting the retrieval lab exposed a service-worker bug: the lab's page could overwrite the main app's offline cache entry. Navigation responses now retain their own request keys. The browser check visits both pages, disables the network, reloads, and runs actual inference again.

The SDK also probed an unpinned metadata URL while discovering tokenizer files, which broke offline startup. The loader now constructs the public feature-extraction pipeline with the exact pinned tokenizer assets. The browser test checks every model request against the immutable revision.

These are the reasons I wanted executable checks and real source images alongside the polished interface.

### What I measured

The [retrieval lab](https://referralglass.onrender.com/lab.html) compares MiniLM with a TF-IDF cosine baseline on **24 fixed synthetic cases**, each with one target passage and five other document types. Both methods receive the same requirements and text. The corpus was fixed before the first run, and all predictions are published.

| Method                          | Top-1 matches on this fixture |
| ------------------------------- | ----------------------------: |
| Local MiniLM semantic retrieval |                   **21 / 24** |
| TF-IDF cosine baseline          |                   **21 / 24** |

The aggregate is a tie. MiniLM finds one paraphrased referral example that the lexical method misses; it also confuses an administrative example that TF-IDF gets right. Both miss two other cases. The [raw report](https://github.com/faraz-shamim/referralglass/blob/main/docs/retrieval-benchmark.json) includes those failures.

This is a small software fixture, not clinical accuracy or evidence of better real-world performance. It supports keeping alternatives and manual source selection available, and keeping human confirmation mandatory.

The repository also includes **24 passing unit/API tests** and a [full browser report](https://github.com/faraz-shamim/referralglass/blob/main/docs/browser-qa.json). The browser checks use actual local embeddings, real PDF parsing, actual English OCR, source confirmations, JSON and A4 PDF exports, mobile layouts, and offline reload. A unique synthetic private marker never appears in outgoing request URLs or bodies. Staff actions are automated with fictional records; clipboard behavior is stubbed during the test.

## Why Does Open Innovation Matter?

An open local model makes the data boundary possible. The browser can encode a document without sending its text to an inference provider, inspect the ranking, and continue with cached assets offline. The same small planner is readable, testable, and runnable on the device or on Render.

It also makes the business hypothesis easier to test. There is no per-document inference API charge or GPU requirement in this prototype. A practice could self-host the code, change its checklist, inspect a failure, or replace the model. Model swaps would need fresh evaluation rather than an assumption that larger means better.

There are still ordinary hosting and download costs and limits. First use downloads roughly 50 MB of generic model/runtime assets; OCR adds its assets when needed. Hugging Face and Render can see normal connection metadata. Browser caches can be evicted, and free Render services sleep and share workspace allowances. This is a prototype deployment, not a production healthcare hosting or compliance claim.

Documents and review state stay in browser memory; exports contain excerpts and need an approved secure workflow. There is no clinical validation, automatic patient identity reconciliation, diagnosis, urgency assessment, treatment recommendation, or automatic sending. A real deployment would need a separate assessment with the practice and appropriate specialists.

## Prize Categories

**Best Use of Render** — the single partner category I am entering. Render serves the agent's frontend, bounded score-planning API, and self-hosted runtime assets, with an on-device fallback when the service is unavailable.

## Credits

Built by **@faraz_s_0a6e70a4bbdc6622** with AI coding assistance. The cover was generated using OpenAI's image tool; [the exact prompt and provenance](https://github.com/faraz-shamim/referralglass/blob/main/docs/artwork.md) are in the repository. Screenshots show the real application with fictional data.

Generic deployment and browser-cache experience from my earlier [Stillroot](https://github.com/faraz-shamim/stillroot) and [ASCEND](https://github.com/faraz-shamim/ascend) projects informed the setup. ReferralGlass is a new project built during this challenge window, with a new ingestion, evidence, planning and review workflow. [Third-party licenses and source credits](https://github.com/faraz-shamim/referralglass/blob/main/THIRD_PARTY.md) are included.

If you work with referral packets, which paperwork requirement would you want your office's first checklist to include?

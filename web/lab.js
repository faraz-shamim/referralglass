import "./style.css";
import corpus from "./lib/benchmark-corpus.json";
import { DEFAULT_REQUIREMENTS, MODEL } from "./lib/config.js";
import { embedTexts } from "./lib/model.js";
import { dot, esc, lexicalRanking } from "./lib/core.js";
let report;
const progress = document.querySelector("#lab-progress"),
  button = document.querySelector("#run-benchmark"),
  output = document.querySelector("#lab-result");
button.onclick = async () => {
  button.disabled = true;
  output.hidden = true;
  progress.textContent = "Loading the local open model…";
  try {
    const docs = [
        ...new Set([
          ...corpus.cases.map((c) => c.text),
          ...Object.values(corpus.distractors),
        ]),
      ],
      queries = DEFAULT_REQUIREMENTS.map((r) => r.query),
      startedAt = new Date().toISOString(),
      at = performance.now();
    const embedded = await embedTexts([...queries, ...docs], (m) => {
      progress.textContent =
        m.type === "batch"
          ? `Encoded ${m.done} of ${m.total} texts on this device…`
          : m.status === "progress"
            ? `Downloading ${m.file || "asset"} · ${Math.round(m.progress || 0)}%`
            : "Preparing local inference…";
    });
    const queryVectors = embedded.vectors.slice(0, queries.length),
      docVectors = embedded.vectors.slice(queries.length);
    let semantic = 0,
      lexical = 0;
    const results = corpus.cases.map((c, index) => {
      const req = DEFAULT_REQUIREMENTS.find((r) => r.id === c.requirementId),
        rIndex = DEFAULT_REQUIREMENTS.indexOf(req);
      const distractors = Object.entries(corpus.distractors)
        .filter(([topic]) => topic !== c.requirementId)
        .map(([topic, text]) => ({ topic, text }));
      const targetIndex = (index * 5) % 6,
        passages = [...distractors];
      passages.splice(targetIndex, 0, { topic: c.requirementId, text: c.text });
      const ranked = passages
        .map((p, i) => ({
          index: i,
          score: dot(queryVectors[rIndex], docVectors[docs.indexOf(p.text)]),
        }))
        .sort((a, b) => b.score - a.score);
      const baseline = lexicalRanking(
        req.query,
        passages.map((p) => p.text),
      );
      const semanticCorrect = ranked[0].index === targetIndex,
        lexicalCorrect = baseline[0].index === targetIndex;
      semantic += semanticCorrect;
      lexical += lexicalCorrect;
      return {
        id: c.id,
        expected: c.requirementId,
        semanticPredicted: passages[ranked[0].index].topic,
        lexicalPredicted: passages[baseline[0].index].topic,
        semanticCorrect,
        lexicalCorrect,
        semanticTopScore: Math.round(ranked[0].score * 10000) / 10000,
      };
    });
    const corpusHash = [
      ...new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify(corpus)),
        ),
      ),
    ]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    report = {
      startedAt,
      finishedAt: new Date().toISOString(),
      model: MODEL,
      backend: "wasm CPU",
      corpus: corpus.format,
      corpusSha256: corpusHash,
      cases: results.length,
      semantic: { correct: semantic, top1Accuracy: semantic / results.length },
      lexical: {
        correct: lexical,
        top1Accuracy: lexical / results.length,
        method: "TF-IDF cosine with simple suffix normalization",
      },
      totalDurationMs: Math.round(performance.now() - at),
      modelDurationMs: embedded.durationMs,
      clinicalValidation: false,
      syntheticDataOnly: true,
      results,
      passed: true,
    };
    output.hidden = false;
    output.innerHTML = `<h2>Measured on this browser</h2><div class="lab-scores"><div>Local semantic retrieval<b>${semantic} / ${results.length}</b></div><div>TF-IDF baseline<b>${lexical} / ${results.length}</b></div><div>Model run, including first-use setup<b>${(embedded.durationMs / 1000).toFixed(1)}s</b></div></div><p class="small-print">Any differences apply only to this fixed synthetic fixture. All real packet findings still require staff review.</p><table class="lab-table"><thead><tr><th>Case</th><th>Semantic</th><th>TF-IDF</th></tr></thead><tbody>${results.map((r) => `<tr><td>${esc(r.id)}</td><td>${r.semanticCorrect ? "Correct" : "Mismatch: " + esc(r.semanticPredicted)}</td><td>${r.lexicalCorrect ? "Correct" : "Mismatch: " + esc(r.lexicalPredicted)}</td></tr>`).join("")}</tbody></table><details style="margin-top:24px"><summary>Raw measured report</summary><pre id="benchmark-json" class="lab-code">${esc(JSON.stringify(report, null, 2))}</pre></details>`;
    document.querySelector("#save-benchmark").disabled = false;
    progress.textContent =
      "Finished. The report records actual inference, the fixed corpus hash, and every prediction.";
  } catch (e) {
    progress.textContent = "Benchmark could not finish: " + e.message;
  } finally {
    button.disabled = false;
  }
};
document.querySelector("#save-benchmark").onclick = () => {
  if (!report) return;
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "referralglass-retrieval-benchmark.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

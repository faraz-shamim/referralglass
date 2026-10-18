import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { LIMITS } from "./config.js";
import { normalizeText } from "./core.js";
let pdfModule, ocrWorker;
export async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
async function pdfjs() {
  if (!pdfModule) {
    pdfModule = await import("pdfjs-dist");
    pdfModule.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  }
  return pdfModule;
}
async function recognize(canvas, onProgress) {
  if (!ocrWorker) {
    const { createWorker } = await import("tesseract.js");
    ocrWorker = await createWorker("eng", 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      workerBlobURL: false,
      cacheMethod: "write",
      logger: (m) => onProgress({ status: m.status, progress: m.progress }),
    });
  }
  const { data } = await ocrWorker.recognize(canvas);
  return {
    text: normalizeText(data.text),
    confidence: Math.round(data.confidence),
    ocr: true,
  };
}
export async function stopOcr() {
  await ocrWorker?.terminate();
  ocrWorker = null;
}
function canvasFor(width, height) {
  const scale = Math.min(1, 1800 / Math.max(width, height)),
    canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  return { canvas, scale };
}
export async function readDocument(
  file,
  { ocr = false, onProgress = () => {} } = {},
) {
  if (!file.size || file.size > LIMITS.fileBytes)
    throw Error("Each file must be non-empty and at most 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer()),
    hash = await sha256(bytes),
    pages = [];
  const type = file.type,
    name = file.name.slice(0, 140);
  if (type === "application/pdf" || /\.pdf$/i.test(name)) {
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
      throw Error("This file does not contain a valid PDF header.");
    let loadingTask;
    try {
      const m = await pdfjs();
      loadingTask = m.getDocument({
        data: bytes.slice(),
        isEvalSupported: false,
        maxImageSize: 4_000_000,
        cMapUrl: "/pdf/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/pdf/standard_fonts/",
        wasmUrl: "/pdf/wasm/",
      });
      const pdf = await loadingTask.promise;
      if (pdf.numPages > LIMITS.pages)
        throw Error(
          "A document can have at most 20 pages. Split this PDF first.",
        );
      for (let n = 1; n <= pdf.numPages; n++) {
        onProgress({ status: `Reading ${name}, page ${n} of ${pdf.numPages}` });
        const page = await pdf.getPage(n),
          content = await page.getTextContent();
        let text = normalizeText(
          content.items
            .map((item) => item.str + (item.hasEOL ? "\n" : " "))
            .join(""),
        );
        let result = { text, ocr: false, confidence: null };
        if (text.length < 30 && ocr) {
          const view = page.getViewport({ scale: 1.8 }),
            { canvas, scale } = canvasFor(view.width, view.height);
          await page.render({
            canvasContext: canvas.getContext("2d"),
            viewport: page.getViewport({ scale: 1.8 * scale }),
          }).promise;
          result = await recognize(canvas, onProgress);
          canvas.width = canvas.height = 0;
        }
        pages.push({ number: n, ...result, needsOcr: result.text.length < 30 });
        page.cleanup();
      }
    } catch (e) {
      if (e.name === "PasswordException")
        throw Error(
          "This PDF is password protected. Use an unlocked copy through your approved workflow.",
        );
      throw e;
    } finally {
      await loadingTask?.destroy();
    }
  } else if (["image/png", "image/jpeg", "image/webp"].includes(type)) {
    if (!ocr)
      throw Error(
        "Enable local scan reading before importing a scanned image.",
      );
    const bitmap = await createImageBitmap(file),
      { canvas } = canvasFor(bitmap.width, bitmap.height);
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const result = await recognize(canvas, onProgress);
    canvas.width = canvas.height = 0;
    pages.push({ number: 1, ...result, needsOcr: result.text.length < 30 });
  } else if (/\.(txt|md)$/i.test(name) || type === "text/plain") {
    const text = normalizeText(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (!text) throw Error("The text document is empty.");
    text
      .split("\f")
      .forEach((text, i) =>
        pages.push({
          number: i + 1,
          text,
          ocr: false,
          confidence: null,
          needsOcr: false,
        }),
      );
    if (pages.length > LIMITS.pages)
      throw Error("A document can have at most 20 pages.");
  } else throw Error("Use PDF, UTF-8 TXT/MD, or PNG/JPEG/WebP scans.");
  if (pages.some((p) => p.text.length > 50000))
    throw Error("A page has too much text. Split this document.");
  const date =
    pages
      .map((p) => p.text)
      .join("\n")
      .match(/Document date:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] || null;
  return {
    id: crypto.randomUUID(),
    name,
    type,
    bytes: file.size,
    hash,
    date,
    pages,
    file,
  };
}
export async function previewPage(doc, number) {
  if (!doc.file) return null;
  if (doc.type.startsWith("image/")) return URL.createObjectURL(doc.file);
  if (doc.type !== "application/pdf" && !/\.pdf$/i.test(doc.name)) return null;
  const m = await pdfjs(),
    loadingTask = m.getDocument({
      data: new Uint8Array(await doc.file.arrayBuffer()),
      isEvalSupported: false,
      cMapUrl: "/pdf/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdf/standard_fonts/",
      wasmUrl: "/pdf/wasm/",
    });
  try {
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(number),
      view = page.getViewport({ scale: 1.5 }),
      { canvas, scale } = canvasFor(view.width, view.height);
    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport: page.getViewport({ scale: 1.5 * scale }),
    }).promise;
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    canvas.width = canvas.height = 0;
    return URL.createObjectURL(blob);
  } finally {
    await loadingTask.destroy();
  }
}

import { mkdir, cp, readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await mkdir("web/public/ocr/core", { recursive: true });
await mkdir("web/public/ocr/lang", { recursive: true });
await cp(
  "node_modules/tesseract.js/dist/worker.min.js",
  "web/public/ocr/worker.min.js",
);
for (const name of await readdir("node_modules/tesseract.js-core"))
  if (name.endsWith(".wasm.js") || name === "LICENSE")
    await cp(
      "node_modules/tesseract.js-core/" + name,
      "web/public/ocr/core/" + name,
    );
for (const name of ["cmaps", "standard_fonts", "wasm"])
  await cp("node_modules/pdfjs-dist/" + name, "web/public/pdf/" + name, {
    recursive: true,
  });
const source = "https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz";
const bytes = await readFile("vendor/ocr/eng.traineddata.gz");
await writeFile("web/public/ocr/lang/eng.traineddata.gz", bytes);
const hash = createHash("sha256").update(bytes).digest("hex");
let lock;
try {
  lock = JSON.parse(await readFile("ocr-data-lock.json", "utf8"));
} catch {}
if (lock && lock.sha256 !== hash)
  throw Error("OCR language checksum differs from the pinned artifact.");
if (!lock)
  await writeFile(
    "ocr-data-lock.json",
    JSON.stringify(
      {
        language: "eng",
        source,
        sha256: hash,
        bytes: bytes.length,
        license: "Apache-2.0",
      },
      null,
      2,
    ),
  );
console.log(
  "Local OCR and PDF assets prepared; English data checksum verified.",
);

const ort = JSON.parse(
  await readFile("node_modules/onnxruntime-web/package.json", "utf8"),
);
const ortBase = "/onnx/" + ort.version + "/";
await mkdir("web/public" + ortBase, { recursive: true });
for (const ext of ["mjs", "wasm"])
  await cp(
    "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify." + ext,
    "web/public" + ortBase + "ort-wasm-simd-threaded.asyncify." + ext,
  );
await writeFile(
  "web/lib/runtime-config.js",
  "export const ORT_BASE = " + JSON.stringify(ortBase) + ";\n",
);

await mkdir("web/public/licenses", { recursive: true });
for (const [source, target] of [
  ["@huggingface/transformers/LICENSE", "transformers-LICENSE"],
  ["tesseract.js/LICENSE.md", "tesseract-LICENSE.md"],
  ["tesseract.js-core/LICENSE", "tesseract-core-LICENSE"],
  ["pdfjs-dist/LICENSE", "pdfjs-LICENSE"],
])
  await cp("node_modules/" + source, "web/public/licenses/" + target);
await cp("vendor/ocr/LICENSE", "web/public/licenses/english-tessdata-LICENSE");
await cp(
  "vendor/onnxruntime/LICENSE",
  "web/public/licenses/onnxruntime-LICENSE",
);
await cp(
  "vendor/onnxruntime/ThirdPartyNotices.txt",
  "web/public/licenses/onnxruntime-ThirdPartyNotices.txt",
);

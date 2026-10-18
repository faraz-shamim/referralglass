# Third-party components and provenance

ReferralGlass application code is MIT. The following works retain their licenses. Exact dependency versions and npm integrity hashes are in `package-lock.json`; this list identifies the main runtime components rather than replacing their complete notices.

| Work                                                                              | Version / revision                         | License                                         | Use                                                                                               |
| --------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2)         | `751bff37182d3f1213fa05d7196b954e230abad9` | Apache-2.0                                      | Browser semantic embeddings; q8 ONNX weights and tokenizer fetched from the pinned model revision |
| [Transformers.js](https://github.com/huggingface/transformers.js)                 | 4.3.1                                      | Apache-2.0                                      | Model pipeline, tokenization, asset caching                                                       |
| [ONNX Runtime Web](https://github.com/microsoft/onnxruntime)                      | `1.31.0-dev.20260914-8d85527a0`            | MIT and bundled third-party notices             | Self-hosted WASM/MJS inference engine                                                             |
| [PDF.js](https://github.com/mozilla/pdf.js)                                       | 6.4.299                                    | Apache-2.0; bundled font/CMap licenses retained | Local PDF parsing, original-page rendering, fonts and decoding assets                             |
| [Tesseract.js](https://github.com/naptha/tesseract.js)                            | 7.0.0                                      | Apache-2.0                                      | Local English OCR worker                                                                          |
| [Tesseract.js Core](https://github.com/naptha/tesseract.js-core)                  | 7.0.0                                      | Apache-2.0                                      | Self-hosted WASM OCR engines                                                                      |
| [Naptha English tessdata](https://github.com/naptha/tessdata/tree/gh-pages/4.0.0) | Pinned bytes below                         | Apache-2.0                                      | Vendored English language data                                                                    |
| [Express](https://github.com/expressjs/express)                                   | 5.3.0                                      | MIT                                             | Stateless score-planning HTTP service                                                             |
| [Vite](https://github.com/vitejs/vite)                                            | 8.3.4                                      | MIT                                             | Application bundling                                                                              |
| [Playwright](https://github.com/microsoft/playwright)                             | 1.64.1                                     | Apache-2.0                                      | Isolated automated browser verification                                                           |

`npm run prepare:assets` copies the runtime notices to `/licenses/` for deployed distribution. PDF.js asset directories retain their bundled font notices. ONNX Runtime's upstream LICENSE and ThirdPartyNotices.txt are vendored at the exact commit recorded in `vendor/onnxruntime/provenance.json` because its npm package omits those standalone files.

## English OCR data

- Original artifact: `https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz`
- Vendored path: `vendor/ocr/eng.traineddata.gz` (10,923,060 bytes).
- SHA-256: `ed350f3752f81ee8f38769edc14d92d997dababe23b565c59879372cc46a2468`.
- Upstream [Apache-2.0 license](https://github.com/naptha/tessdata/blob/gh-pages/LICENSE) is preserved at `vendor/ocr/LICENSE`.
- `ocr-data-lock.json` records the artifact; preparation verifies it before copying. No live language download is needed during the build.

## Application, sample data and artwork

The new medical-office workflow, source-span/citation index, bounded planner, interface, synthetic corpus, packet fixtures and tests were created for this challenge with AI coding assistance. Generic Render deployment and browser-cache experience from [Stillroot](https://github.com/faraz-shamim/stillroot) and [ASCEND](https://github.com/faraz-shamim/ascend) informed the setup. Their products, data and earlier challenge submissions are not part of this entry.

The cover uses OpenAI image generation. The exact prompt, original saved artifact and optimized formats are documented in [docs/artwork.md](docs/artwork.md). The UI icon and document illustration are original SVG/CSS. All medical records, clinic names, signatures and contact details bundled in this project are fictional software fixtures. They are not medical advice, valid consent forms or copies of real patient records.

[AHRQ Tool 21: Make Referrals Easy](https://www.ahrq.gov/health-literacy/improve/precautions/tool21.html) is cited as background for organizing referral information. No AHRQ content, official checklist, endorsement or clinical validation is claimed.

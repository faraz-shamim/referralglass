import express from "express";
import { existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { planReview, PLANNER_VERSION } from "../web/lib/planner.js";
export function createApp({ staticDir, vite } = {}) {
  const app = express(),
    buckets = new Map();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' ws://127.0.0.1:* ws://localhost:* https://huggingface.co https://*.huggingface.co https://*.hf.co; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    });
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "32kb", strict: true }));
  app.get("/api/health", (_, res) =>
    res.json({
      ok: true,
      app: "ReferralGlass",
      version: "1.0.0",
      plannerVersion: PLANNER_VERSION,
      storage: "none",
      render: !!process.env.RENDER,
      commit: process.env.RENDER_GIT_COMMIT || null,
      documentTextAccepted: false,
    }),
  );
  app.post("/api/plan", (req, res, next) => {
    try {
      const now = Date.now(),
        key = req.ip;
      let entry = buckets.get(key);
      if (!entry || now - entry.at > 3600000) {
        entry = { at: now, count: 0 };
        if (buckets.size > 2000) buckets.delete(buckets.keys().next().value);
        buckets.set(key, entry);
      }
      if (++entry.count > 120) {
        res.set("Retry-After", "60");
        return res
          .status(429)
          .json({
            error:
              "The public planner is busy. Local planning remains available.",
          });
      }
      const start = performance.now(),
        result = planReview(req.body);
      res.json({
        ...result,
        runtime: process.env.RENDER ? "render" : "local-server",
        durationMs: Math.round((performance.now() - start) * 100) / 100,
      });
    } catch (e) {
      next(e);
    }
  });
  app.use("/api", (_, res) =>
    res
      .status(404)
      .json({
        error:
          "Endpoint not available. Document uploads are not accepted by this server.",
      }),
  );
  if (vite) app.use(vite.middlewares);
  else if (staticDir) {
    app.use((req, res, next) => {
      if (
        req.method !== "GET" ||
        !/^\/(?:assets\/[A-Za-z0-9_.-]+|onnx\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|ocr\/core\/[A-Za-z0-9_.-]+)\.(?:js|mjs|wasm|css)$/.test(
          req.path,
        ) ||
        !req.acceptsEncodings("gzip")
      )
        return next();
      const path = resolve(staticDir, "." + req.path + ".gz");
      if (!existsSync(path)) return next();
      res.vary("Accept-Encoding");
      res.type(extname(req.path));
      res.set({
        "Content-Encoding": "gzip",
        "Cache-Control": "public, max-age=86400",
      });
      res.sendFile(path);
    });
    app.use(
      express.static(resolve(staticDir), {
        setHeaders: (res, path) => {
          if (path.endsWith("sw.js") || path.endsWith("index.html"))
            res.setHeader("Cache-Control", "no-cache");
        },
      }),
    );
    app.get("/{*path}", (_, res) =>
      res.sendFile(resolve(staticDir, "index.html")),
    );
  }
  app.use((e, req, res, next) => {
    if (res.headersSent) return next(e);
    res.removeHeader("Content-Encoding");
    res.removeHeader("Content-Length");
    res
      .status(
        e.status === 400 ? 400 : e.type === "entity.too.large" ? 413 : 500,
      )
      .json({
        error:
          e.status === 400
            ? e.type
              ? "Invalid JSON score request."
              : e.message
            : e.type === "entity.too.large"
              ? "Request is too large."
              : "The planner could not finish. Local planning remains available.",
      });
  });
  return app;
}

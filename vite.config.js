import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  root: "web",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rolldownOptions: {
      input: { main: resolve("web/index.html"), lab: resolve("web/lab.html") },
    },
  },
  worker: { format: "es" },
  server: { host: "127.0.0.1" },
});

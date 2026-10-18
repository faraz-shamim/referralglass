import { createApp } from "./app.js";
const production =
  process.argv.includes("--production") ||
  process.env.NODE_ENV === "production";
let vite;
if (!production) {
  const { createServer } = await import("vite");
  vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
}
const app = createApp({ vite, staticDir: production ? "dist" : null });
const server = app.listen(
  Number(process.env.PORT || 4176),
  production ? "0.0.0.0" : "127.0.0.1",
  () => console.log("ReferralGlass ready; document storage=none"),
);
const stop = async () => {
  server.close();
  await vite?.close();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);

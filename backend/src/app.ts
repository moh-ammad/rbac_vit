import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.js";
import routes from "./routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // The frontend normally proxies /api to us (same origin), but direct calls
  // from the dev frontend are allowed too — with cookies.
  app.use(cors({ origin: env.frontendUrl, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", routes);
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);
  return app;
}

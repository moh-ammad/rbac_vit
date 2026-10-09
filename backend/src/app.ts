import cors, { type CorsOptions } from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.js";
import routes from "./routes.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.trustProxy);

  // Allowed frontend origins
  const allowedOrigins = [
    env.frontendUrl,
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ].filter((origin): origin is string => Boolean(origin));

  // CORS configuration
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },

    credentials: true,

    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"],

    optionsSuccessStatus: 200,
  };

  // Global CORS middleware
  app.use(cors(corsOptions));

  // Handle preflight requests (Express 5)
  app.options("/{*splat}", cors(corsOptions));

  // JSON body parser middleware
  app.use(express.json({ limit: "1mb" }));

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // All API routes
  app.use("/api", routes);

  // 404 handler for unknown API endpoints
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Global error-handling middleware
  app.use(errorHandler);

  return app;
}
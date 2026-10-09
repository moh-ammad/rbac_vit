import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../lib/http.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const field = issue?.path.join(".");
    return res.status(400).json({ error: field ? `${field}: ${issue?.message}` : issue?.message ?? "Invalid input" });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return res.status(409).json({ error: "That name is already taken" });
    if (err.code === "P2025") return res.status(404).json({ error: "Item not found" });
    if (err.code === "P2003") return res.status(400).json({ error: "A related item does not exist" });
    if (err.code === "P1010") return res.status(503).json({ error: "The database rejected the connection. Check the deployed DATABASE_URL credentials and database permissions." });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
}

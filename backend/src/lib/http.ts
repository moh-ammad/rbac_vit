import type { Request } from "express";
import { z } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const forbidden = (message = "You do not have access to this") => new HttpError(403, message);
export const notFound = (what = "Item") => new HttpError(404, `${what} not found`);

/** Route param as a validated uuid. */
export function idParam(req: Request, name = "id"): string {
  const raw = req.params[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw badRequest(`Invalid ${name}`);
  return parsed.data;
}

/** Optional string query param. */
export function queryString(req: Request, name: string): string | undefined {
  const raw = req.query[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

// The session lives in an httpOnly cookie, never in localStorage, so page
// scripts cannot read or steal it.
export const SESSION_COOKIE = "lms_session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const comparePassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export function signSession(userId: string) {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: "7d" });
}

export function readSession(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) {
      try {
        const payload = jwt.verify(decodeURIComponent(rest.join("=")), env.jwtSecret);
        return typeof payload === "object" && typeof payload.sub === "string" ? payload.sub : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function setSessionCookie(res: Response, userId: string) {
  res.cookie(SESSION_COOKIE, signSession(userId), { httpOnly: true, sameSite: "lax", secure: env.cookieSecure, maxAge: MAX_AGE_MS, path: "/" });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: env.cookieSecure, path: "/" });
}

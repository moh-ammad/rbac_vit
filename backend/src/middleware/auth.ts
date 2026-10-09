import type { NextFunction, Request, Response } from "express";
import type { PermissionKey } from "../config/permissions.js";
import { readSession } from "../lib/auth-tokens.js";
import { HttpError, forbidden } from "../lib/http.js";
import { type Access, loadAccess } from "../services/access.service.js";

declare global {
  namespace Express {
    interface Request {
      access?: Access;
    }
  }
}

/** Reads the session cookie and loads the user's live access from the DB. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const userId = readSession(req);
  if (!userId) return next(new HttpError(401, "Please sign in"));
  const access = await loadAccess(userId);
  if (!access) return next(new HttpError(401, "Account no longer exists"));
  req.access = access;
  next();
}

/** Blocks pending/suspended users and users whose role was disabled. */
export function requireActive(req: Request, _res: Response, next: NextFunction) {
  const access = req.access!;
  if (access.status === "SUSPENDED") return next(forbidden("Your account is suspended"));
  if (access.status === "PENDING" || !access.role) return next(forbidden("Your account is waiting for a role"));
  if (!access.role.isActive && !access.isSuperAdmin) return next(forbidden("Your role is disabled"));
  next();
}

/** Allows the request when the user holds ANY of the given permissions. */
export function requirePermission(...permissions: PermissionKey[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    requireActive(req, res, (error?: unknown) => {
      if (error) return next(error);
      const access = req.access!;
      if (!permissions.some((p) => access.permissions.has(p))) return next(forbidden());
      next();
    });
  };
}

/** Narrowing helper for handlers that run after `authenticate`. */
export function getAccess(req: Request): Access {
  if (!req.access) throw new HttpError(401, "Please sign in");
  return req.access;
}

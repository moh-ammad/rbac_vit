import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { clearSessionCookie, comparePassword, hashPassword, setSessionCookie } from "../../lib/auth-tokens.js";
import { authenticate, getAccess } from "../../middleware/auth.js";
import { authRateLimit } from "../../middleware/rate-limit.js";
import { serializeAccess } from "../../services/access.service.js";

const router = Router();

const loginInput = z.object({ email: z.email().transform((v) => v.toLowerCase()), password: z.string().min(1) });
const registerInput = z.object({ name: z.string().trim().min(2).max(80), email: z.email().transform((v) => v.toLowerCase()), password: z.string().min(6).max(100) });

// New accounts get NO role. They stay PENDING until someone with
// users.manage assigns one from the Users page.
router.post("/auth/register", authRateLimit, async (req, res) => {
  const data = registerInput.parse(req.body);
  if (await prisma.user.findUnique({ where: { email: data.email } })) throw new HttpError(409, "An account with this email already exists");
  const user = await prisma.user.create({ data: { name: data.name, email: data.email, password: await hashPassword(data.password), status: "PENDING" } });
  setSessionCookie(res, user.id);
  res.status(201).json({ ok: true });
});

router.post("/auth/login", authRateLimit, async (req, res) => {
  const { email, password } = loginInput.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await comparePassword(password, user.password))) throw new HttpError(401, "Wrong email or password");
  if (user.status === "SUSPENDED") throw new HttpError(403, "This account is suspended");
  setSessionCookie(res, user.id);
  res.json({ ok: true });
});

router.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// The frontend calls this on every page load to know who is signed in and
// what they may see. Nothing is cached in the browser.
router.get("/me", authenticate, (req, res) => {
  res.json({ user: serializeAccess(getAccess(req)) });
});

router.patch("/me", authenticate, async (req, res) => {
  const access = getAccess(req);
  const data = z.object({ name: z.string().trim().min(2).max(80).optional(), currentPassword: z.string().optional(), newPassword: z.string().min(6).max(100).optional() }).parse(req.body);
  const update: { name?: string; password?: string } = {};
  if (data.name) update.name = data.name;
  if (data.newPassword) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: access.userId } });
    if (!data.currentPassword || !(await comparePassword(data.currentPassword, user.password))) throw new HttpError(400, "Current password is wrong");
    update.password = await hashPassword(data.newPassword);
  }
  await prisma.user.update({ where: { id: access.userId }, data: update });
  res.json({ ok: true });
});

export default router;

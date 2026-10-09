import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client.js";
import { forbidden, idParam, notFound } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { getAccess, requirePermission } from "../../middleware/auth.js";
import { type Access, assertClassScope } from "../../services/access.service.js";

const router = Router();

const select = { id: true, title: true, body: true, isPinned: true, createdAt: true, updatedAt: true, classGroup: { select: { id: true, name: true } }, createdBy: { select: { name: true } } } satisfies Prisma.InstructionSelect;

/** School-wide instructions + the ones for the user's classes. */
function scopeWhere(access: Access): Prisma.InstructionWhereInput {
  return access.classIds === null ? {} : { OR: [{ classId: null }, { classId: { in: access.classIds } }] };
}

router.get("/instructions", requirePermission("instructions.view", "instructions.manage"), async (req, res) => {
  const items = await prisma.instruction.findMany({ where: scopeWhere(getAccess(req)), orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }], select });
  res.json({ instructions: items });
});

const input = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  classId: z.uuid().nullable().optional(),
  isPinned: z.boolean().default(false),
});

function check(access: Access, classId: string | null | undefined) {
  if (classId) assertClassScope(access, classId);
  else if (!access.unrestricted) throw forbidden("Pick one of your classes — school-wide notices need full access");
}

async function loadEditable(access: Access, id: string) {
  const item = await prisma.instruction.findUnique({ where: { id }, select: { id: true, classId: true } });
  if (!item) throw notFound("Instruction");
  check(access, item.classId);
  return item;
}

router.post("/instructions", requirePermission("instructions.manage"), async (req, res) => {
  const access = getAccess(req);
  const data = input.parse(req.body);
  check(access, data.classId);
  res.status(201).json({ instruction: await prisma.instruction.create({ data: { title: data.title, body: data.body, classId: data.classId ?? null, isPinned: data.isPinned, createdById: access.userId }, select }) });
});

router.put("/instructions/:id", requirePermission("instructions.manage"), async (req, res) => {
  const access = getAccess(req);
  const existing = await loadEditable(access, idParam(req));
  const data = input.parse(req.body);
  check(access, data.classId);
  res.json({ instruction: await prisma.instruction.update({ where: { id: existing.id }, data: { title: data.title, body: data.body, classId: data.classId ?? null, isPinned: data.isPinned }, select }) });
});

router.delete("/instructions/:id", requirePermission("instructions.manage"), async (req, res) => {
  const existing = await loadEditable(getAccess(req), idParam(req));
  await prisma.instruction.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

export default router;

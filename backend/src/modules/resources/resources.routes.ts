// Books, blogs, notes and links — with server-side search & filters.

import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client.js";
import { forbidden, idParam, notFound, queryString } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { getAccess, requirePermission } from "../../middleware/auth.js";
import { type Access, assertClassSubjectScope, inClassSubjectScope } from "../../services/access.service.js";
import { PAGE_SIZE, assertTopicBelongs, classSubjectLabelSelect, pageArgs } from "../../services/content.service.js";

const router = Router();
const TYPES = ["BOOK", "BLOG", "NOTES", "LINK"] as const;

const resourceSelect = {
  id: true, title: true, description: true, type: true, url: true, author: true, createdAt: true, updatedAt: true,
  classSubject: { select: classSubjectLabelSelect },
  topic: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ResourceSelect;

/** General resources (no class) are visible to everyone with resources.view. */
function scopeWhere(access: Access): Prisma.ResourceWhereInput {
  if (access.classSubjectIds === null) return {};
  return { OR: [{ classSubjectId: null }, { classSubjectId: { in: access.classSubjectIds } }] };
}

router.get("/resources", requirePermission("resources.view"), async (req, res) => {
  const access = getAccess(req);
  const q = queryString(req, "q");
  const type = queryString(req, "type");
  const classId = queryString(req, "classId");
  const subjectId = queryString(req, "subjectId");
  const { page, skip, take } = pageArgs(req.query.page);

  const where: Prisma.ResourceWhereInput = {
    AND: [
      scopeWhere(access),
      type && (TYPES as readonly string[]).includes(type) ? { type: type as (typeof TYPES)[number] } : {},
      classId ? { classSubject: { classId } } : {},
      subjectId ? { classSubject: { subjectId } } : {},
      q ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { author: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
          { topic: { name: { contains: q, mode: "insensitive" } } },
          { classSubject: { subject: { name: { contains: q, mode: "insensitive" } } } },
        ],
      } : {},
    ],
  };
  const [items, total, byType] = await Promise.all([
    prisma.resource.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, select: resourceSelect }),
    prisma.resource.count({ where }),
    prisma.resource.groupBy({ by: ["type"], where: scopeWhere(access), _count: { _all: true } }),
  ]);
  res.json({ resources: items, total, page, pageSize: PAGE_SIZE, counts: Object.fromEntries(byType.map((t) => [t.type, t._count._all])) });
});

router.get("/resources/:id", requirePermission("resources.view"), async (req, res) => {
  const access = getAccess(req);
  const item = await prisma.resource.findUnique({ where: { id: idParam(req) }, select: { ...resourceSelect, content: true } });
  if (!item || (item.classSubject && !inClassSubjectScope(access, item.classSubject.id))) throw notFound("Resource");
  res.json({ resource: item });
});

const resourceInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  type: z.enum(TYPES),
  url: z.url().max(500).nullable().optional().or(z.literal("").transform(() => null)),
  content: z.string().max(50000).nullable().optional(),
  author: z.string().trim().max(120).nullable().optional(),
  classSubjectId: z.uuid().nullable().optional(),
  topicId: z.uuid().nullable().optional(),
});

async function validate(access: Access, data: z.infer<typeof resourceInput>) {
  if (data.classSubjectId) assertClassSubjectScope(access, data.classSubjectId);
  else if (!access.unrestricted) throw forbidden("Pick one of your classes for this resource");
  await assertTopicBelongs(data.topicId, data.classSubjectId);
  return {
    title: data.title, type: data.type,
    description: data.description ?? null, url: data.url ?? null, content: data.content ?? null, author: data.author ?? null,
    classSubjectId: data.classSubjectId ?? null, topicId: data.topicId ?? null,
  };
}

async function loadEditable(access: Access, id: string) {
  const item = await prisma.resource.findUnique({ where: { id }, select: { id: true, classSubjectId: true } });
  if (!item) throw notFound("Resource");
  if (item.classSubjectId) assertClassSubjectScope(access, item.classSubjectId);
  else if (!access.unrestricted) throw forbidden();
  return item;
}

router.post("/resources", requirePermission("resources.manage"), async (req, res) => {
  const access = getAccess(req);
  const data = await validate(access, resourceInput.parse(req.body));
  const item = await prisma.resource.create({ data: { ...data, createdById: access.userId }, select: resourceSelect });
  res.status(201).json({ resource: item });
});

router.put("/resources/:id", requirePermission("resources.manage"), async (req, res) => {
  const access = getAccess(req);
  const existing = await loadEditable(access, idParam(req));
  const data = await validate(access, resourceInput.parse(req.body));
  res.json({ resource: await prisma.resource.update({ where: { id: existing.id }, data, select: resourceSelect }) });
});

router.delete("/resources/:id", requirePermission("resources.manage"), async (req, res) => {
  const existing = await loadEditable(getAccess(req), idParam(req));
  await prisma.resource.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

export default router;

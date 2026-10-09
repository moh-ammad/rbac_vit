import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client.js";
import { idParam, notFound, queryString } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { getAccess, requirePermission } from "../../middleware/auth.js";
import { type Access, assertClassSubjectScope, classSubjectWhere, inClassSubjectScope } from "../../services/access.service.js";
import { PAGE_SIZE, assertTopicBelongs, classSubjectLabelSelect, pageArgs } from "../../services/content.service.js";

const router = Router();

export const videoSelect = {
  id: true, title: true, description: true, url: true, createdAt: true,
  classSubject: { select: classSubjectLabelSelect },
  topic: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.VideoSelect;

router.get("/videos", requirePermission("videos.view"), async (req, res) => {
  const access = getAccess(req);
  const q = queryString(req, "q");
  const classId = queryString(req, "classId");
  const subjectId = queryString(req, "subjectId");
  const topicId = queryString(req, "topicId");
  const { page, skip, take } = pageArgs(req.query.page);
  const where: Prisma.VideoWhereInput = {
    AND: [
      classSubjectWhere(access),
      classId ? { classSubject: { classId } } : {},
      subjectId ? { classSubject: { subjectId } } : {},
      topicId ? { topicId } : {},
      q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }, { topic: { name: { contains: q, mode: "insensitive" } } }, { classSubject: { subject: { name: { contains: q, mode: "insensitive" } } } }] } : {},
    ],
  };
  const [videos, total] = await Promise.all([
    prisma.video.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, select: videoSelect }),
    prisma.video.count({ where }),
  ]);
  res.json({ videos, total, page, pageSize: PAGE_SIZE });
});

const videoInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  url: z.url().max(500),
  classSubjectId: z.uuid(),
  topicId: z.uuid().nullable().optional(),
});

async function validate(access: Access, raw: unknown) {
  const data = videoInput.parse(raw);
  assertClassSubjectScope(access, data.classSubjectId);
  await assertTopicBelongs(data.topicId, data.classSubjectId);
  return { title: data.title, description: data.description ?? null, url: data.url, classSubjectId: data.classSubjectId, topicId: data.topicId ?? null };
}

async function loadEditable(access: Access, id: string) {
  const item = await prisma.video.findUnique({ where: { id }, select: { id: true, classSubjectId: true } });
  if (!item || !inClassSubjectScope(access, item.classSubjectId)) throw notFound("Video");
  return item;
}

router.post("/videos", requirePermission("videos.manage"), async (req, res) => {
  const access = getAccess(req);
  const data = await validate(access, req.body);
  res.status(201).json({ video: await prisma.video.create({ data: { ...data, createdById: access.userId }, select: videoSelect }) });
});

router.put("/videos/:id", requirePermission("videos.manage"), async (req, res) => {
  const access = getAccess(req);
  const existing = await loadEditable(access, idParam(req));
  const data = await validate(access, req.body);
  res.json({ video: await prisma.video.update({ where: { id: existing.id }, data, select: videoSelect }) });
});

router.delete("/videos/:id", requirePermission("videos.manage"), async (req, res) => {
  const existing = await loadEditable(getAccess(req), idParam(req));
  await prisma.video.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

export default router;

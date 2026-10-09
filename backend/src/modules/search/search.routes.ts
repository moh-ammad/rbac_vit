// Global search across everything the user is allowed to see.

import { Router } from "express";
import type { Prisma } from "../../../generated/prisma/client.js";
import { queryString } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { getAccess, requireActive } from "../../middleware/auth.js";
import { can, classSubjectWhere, classWhere } from "../../services/access.service.js";
import { classSubjectLabelSelect } from "../../services/content.service.js";

const router = Router();

router.get("/search", requireActive, async (req, res) => {
  const access = getAccess(req);
  const q = queryString(req, "q") ?? "";
  if (q.length < 2) return res.json({ results: { classes: [], resources: [], videos: [], papers: [], users: [] } });
  const like = { contains: q, mode: "insensitive" as const };
  const cs = classSubjectWhere(access);
  const resourceScope: Prisma.ResourceWhereInput = access.classSubjectIds === null ? {} : { OR: [{ classSubjectId: null }, { classSubjectId: { in: access.classSubjectIds } }] };

  const [classes, resources, videos, papers, users] = await Promise.all([
    can(access, "classes.view") ? prisma.classGroup.findMany({ where: { ...classWhere(access, "id"), name: like }, take: 8, select: { id: true, name: true } }) : [],
    can(access, "resources.view") ? prisma.resource.findMany({ where: { AND: [resourceScope, { OR: [{ title: like }, { description: like }, { author: like }] }] }, take: 8, select: { id: true, title: true, type: true, classSubject: { select: classSubjectLabelSelect } } }) : [],
    can(access, "videos.view") ? prisma.video.findMany({ where: { ...cs, OR: [{ title: like }, { description: like }, { topic: { name: like } }] }, take: 8, select: { id: true, title: true, url: true, classSubject: { select: classSubjectLabelSelect } } }) : [],
    can(access, "papers.view") || can(access, "papers.attempt") || can(access, "papers.manage")
      ? prisma.questionPaper.findMany({ where: { ...cs, ...(can(access, "papers.manage") ? {} : { isPublished: true }), title: like }, take: 8, select: { id: true, title: true, classSubject: { select: classSubjectLabelSelect } } })
      : [],
    can(access, "users.view") && access.unrestricted ? prisma.user.findMany({ where: { OR: [{ name: like }, { email: like }] }, take: 8, select: { id: true, name: true, email: true, role: { select: { name: true } } } }) : [],
  ]);
  res.json({ results: { classes, resources, videos, papers, users } });
});

export default router;

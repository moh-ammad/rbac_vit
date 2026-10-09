// One endpoint that returns only the widgets the user is allowed to see.

import { Router } from "express";
import type { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { getAccess, requireActive } from "../../middleware/auth.js";
import { can, classSubjectWhere, classWhere } from "../../services/access.service.js";
import { analyzeStudent } from "../../services/analysis.service.js";
import { classSubjectLabelSelect } from "../../services/content.service.js";

const router = Router();

router.get("/dashboard", requireActive, async (req, res) => {
  const access = getAccess(req);
  const cs = classSubjectWhere(access);
  const resourceScope: Prisma.ResourceWhereInput = access.classSubjectIds === null ? {} : { OR: [{ classSubjectId: null }, { classSubjectId: { in: access.classSubjectIds } }] };
  const instructionScope: Prisma.InstructionWhereInput = access.classIds === null ? {} : { OR: [{ classId: null }, { classId: { in: access.classIds } }] };
  const manager = can(access, "papers.manage");

  const stats: Record<string, number> = {};
  const tasks: Promise<void>[] = [];
  if (can(access, "classes.view")) tasks.push(prisma.classGroup.count({ where: classWhere(access, "id") }).then((n) => { stats.classes = n; }));
  if (can(access, "classes.view")) tasks.push(prisma.classSubject.count({ where: access.classSubjectIds === null ? {} : { id: { in: access.classSubjectIds } } }).then((n) => { stats.subjects = n; }));
  if (can(access, "resources.view")) tasks.push(prisma.resource.count({ where: resourceScope }).then((n) => { stats.resources = n; }));
  if (can(access, "videos.view")) tasks.push(prisma.video.count({ where: cs }).then((n) => { stats.videos = n; }));
  if (can(access, "papers.view") || can(access, "papers.attempt") || manager) tasks.push(prisma.questionPaper.count({ where: { ...cs, ...(manager ? {} : { isPublished: true }) } }).then((n) => { stats.papers = n; }));
  if (can(access, "users.view") && access.unrestricted) tasks.push(prisma.user.count().then((n) => { stats.users = n; }));
  if (can(access, "users.manage")) tasks.push(prisma.user.count({ where: { status: "PENDING" } }).then((n) => { stats.pendingUsers = n; }));
  await Promise.all(tasks);

  const [instructions, latestResources, latestVideos] = await Promise.all([
    can(access, "instructions.view") ? prisma.instruction.findMany({ where: instructionScope, orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }], take: 4, select: { id: true, title: true, body: true, isPinned: true, createdAt: true, classGroup: { select: { name: true } } } }) : [],
    can(access, "resources.view") ? prisma.resource.findMany({ where: resourceScope, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, title: true, type: true, classSubject: { select: classSubjectLabelSelect } } }) : [],
    can(access, "videos.view") ? prisma.video.findMany({ where: cs, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, title: true, url: true, classSubject: { select: classSubjectLabelSelect }, topic: { select: { name: true } } } }) : [],
  ]);

  // Student widgets: open tests + personal analysis.
  let student = null;
  // The Super Admin holds every permission but is not a test-taker.
  if (can(access, "papers.attempt") && !access.isSuperAdmin) {
    const attempted = await prisma.testAttempt.findMany({ where: { userId: access.userId }, select: { paperId: true }, distinct: ["paperId"] });
    const pending = await prisma.questionPaper.findMany({
      where: { ...cs, isPublished: true, id: { notIn: attempted.map((a) => a.paperId) } },
      orderBy: { createdAt: "desc" }, take: 5,
      select: { id: true, title: true, durationMinutes: true, classSubject: { select: classSubjectLabelSelect }, _count: { select: { questions: true } } },
    });
    student = { pendingTests: pending, analysis: await analyzeStudent(access.userId, access.classSubjectIds) };
  }

  // Teacher widgets: latest submissions in scope.
  let recentAttempts = null;
  if (can(access, "results.view")) {
    recentAttempts = await prisma.testAttempt.findMany({
      where: { paper: cs },
      orderBy: { submittedAt: "desc" }, take: 6,
      select: { id: true, percentage: true, submittedAt: true, user: { select: { id: true, name: true } }, paper: { select: { id: true, title: true, classSubject: { select: classSubjectLabelSelect } } } },
    });
  }

  res.json({ stats, instructions, latestResources, latestVideos, student, recentAttempts });
});

export default router;

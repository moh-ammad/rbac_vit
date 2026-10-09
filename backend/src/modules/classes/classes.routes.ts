// Classes, subjects, the subjects taught in each class, and their topics.

import { Router } from "express";
import { z } from "zod";
import { badRequest, forbidden, idParam, notFound } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { getAccess, requireActive, requirePermission } from "../../middleware/auth.js";
import { type Access, assertClassScope, assertClassSubjectScope, can, classWhere, inClassSubjectScope } from "../../services/access.service.js";

const router = Router();

/** People whose role covers a class, split into teachers and students. */
async function classMembers(classId: string) {
  const [roles, links] = await Promise.all([
    prisma.role.findMany({
      where: {
        isActive: true, isSuperAdmin: false, audience: { in: ["TEACHER", "STUDENT"] },
        OR: [{ allClasses: true }, { classes: { some: { classId } } }, { classSubjects: { some: { classSubject: { classId } } } }],
      },
      select: {
        id: true, name: true, audience: true, allClasses: true,
        classes: { where: { classId }, select: { allSubjects: true } },
        classSubjects: { where: { classSubject: { classId } }, select: { classSubjectId: true } },
        users: { where: { status: "ACTIVE" }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } },
      },
    }),
    prisma.classSubject.findMany({ where: { classId }, select: { id: true } }),
  ]);
  const allIds = links.map((l) => l.id);
  const teachers: { id: string; name: string; email: string; roleName: string; classSubjectIds: string[] }[] = [];
  const students: { id: string; name: string; email: string; roleName: string }[] = [];
  for (const role of roles) {
    const covered = role.allClasses || role.classes[0]?.allSubjects ? allIds : role.classSubjects.map((c) => c.classSubjectId);
    for (const user of role.users) {
      if (role.audience === "TEACHER") teachers.push({ ...user, roleName: role.name, classSubjectIds: covered });
      else students.push({ ...user, roleName: role.name });
    }
  }
  return { teachers, students };
}

// ─── Lookup used by every form/filter: class-subjects the user can see ───────

router.get("/class-subjects", requireActive, async (req, res) => {
  const access = getAccess(req);
  const items = await prisma.classSubject.findMany({
    where: access.classSubjectIds === null ? {} : { id: { in: access.classSubjectIds } },
    orderBy: [{ classGroup: { grade: "asc" } }, { classGroup: { name: "asc" } }, { subject: { name: "asc" } }],
    select: { id: true, classGroup: { select: { id: true, name: true, grade: true } }, subject: { select: { id: true, name: true } }, topics: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
  });
  res.json({ classSubjects: items.map((i) => ({ id: i.id, class: i.classGroup, subject: i.subject, topics: i.topics, label: `${i.classGroup.name} · ${i.subject.name}` })) });
});

// ─── Classes ────────────────────────────────────────────────────────────────

router.get("/classes", requirePermission("classes.view"), async (req, res) => {
  const access = getAccess(req);
  const classes = await prisma.classGroup.findMany({
    where: classWhere(access, "id"),
    orderBy: [{ grade: "asc" }, { name: "asc" }],
    select: { id: true, name: true, grade: true, description: true, subjects: { orderBy: { subject: { name: "asc" } }, select: { id: true, subject: { select: { id: true, name: true } }, _count: { select: { topics: true } } } } },
  });
  res.json({
    classes: classes.map((c) => ({
      ...c,
      subjects: c.subjects.filter((s) => inClassSubjectScope(access, s.id)).map((s) => ({ classSubjectId: s.id, subjectId: s.subject.id, name: s.subject.name, topics: s._count.topics })),
    })),
  });
});

router.get("/classes/:id", requirePermission("classes.view"), async (req, res) => {
  const access = getAccess(req);
  const id = idParam(req);
  assertClassScope(access, id);
  const item = await prisma.classGroup.findUnique({
    where: { id },
    select: {
      id: true, name: true, grade: true, description: true,
      subjects: {
        orderBy: { subject: { name: "asc" } },
        select: { id: true, subject: { select: { id: true, name: true } }, topics: { orderBy: { name: "asc" }, select: { id: true, name: true } }, _count: { select: { resources: true, videos: true, papers: true } } },
      },
    },
  });
  if (!item) throw notFound("Class");
  const members = await classMembers(id);
  const subjects = item.subjects.filter((s) => inClassSubjectScope(access, s.id)).map((s) => ({
    classSubjectId: s.id, subjectId: s.subject.id, name: s.subject.name, topics: s.topics, counts: s._count,
    teachers: members.teachers.filter((t) => t.classSubjectIds.includes(s.id)).map(({ classSubjectIds: _ignored, ...t }) => t),
  }));
  // Students see their classmates' count only; staff with users.view see the list.
  const showStudents = can(access, "users.view") || can(access, "users.manage") || access.role?.audience !== "STUDENT";
  res.json({
    class: { id: item.id, name: item.name, grade: item.grade, description: item.description },
    subjects,
    teachers: members.teachers.map(({ classSubjectIds, ...t }) => ({ ...t, subjects: item.subjects.filter((s) => classSubjectIds.includes(s.id)).map((s) => s.subject.name) })),
    students: showStudents ? members.students : [],
    studentCount: members.students.length,
  });
});

const classInput = z.object({ name: z.string().trim().min(1).max(80), grade: z.number().int().min(0).max(20).nullable().optional(), description: z.string().trim().max(300).nullable().optional() });

function requireUnrestricted(access: Access) {
  if (!access.unrestricted) throw forbidden("Only users with access to all classes can do this");
}

router.post("/classes", requirePermission("classes.manage"), async (req, res) => {
  requireUnrestricted(getAccess(req));
  const data = classInput.parse(req.body);
  const item = await prisma.classGroup.create({ data: { name: data.name, grade: data.grade ?? null, description: data.description ?? null } });
  res.status(201).json({ class: item });
});

router.put("/classes/:id", requirePermission("classes.manage"), async (req, res) => {
  const id = idParam(req);
  assertClassScope(getAccess(req), id);
  const data = classInput.parse(req.body);
  const item = await prisma.classGroup.update({ where: { id }, data: { name: data.name, grade: data.grade ?? null, description: data.description ?? null } });
  res.json({ class: item });
});

router.delete("/classes/:id", requirePermission("classes.manage"), async (req, res) => {
  requireUnrestricted(getAccess(req));
  await prisma.classGroup.delete({ where: { id: idParam(req) } });
  res.json({ ok: true });
});

// Add a subject to a class (by id, or by name — creates the subject if new).
router.post("/classes/:id/subjects", requirePermission("classes.manage"), async (req, res) => {
  const classId = idParam(req);
  const access = getAccess(req);
  assertClassScope(access, classId);
  if (access.classSubjectIds !== null) throw forbidden("Only users with full access to a class can add subjects to it");
  const data = z.object({ subjectId: z.uuid().optional(), name: z.string().trim().min(1).max(80).optional() }).parse(req.body);
  let subjectId = data.subjectId;
  if (!subjectId) {
    if (!data.name) throw badRequest("Pick a subject or type a new subject name");
    const subject = await prisma.subject.upsert({ where: { name: data.name }, update: {}, create: { name: data.name } });
    subjectId = subject.id;
  }
  const link = await prisma.classSubject.create({ data: { classId, subjectId }, select: { id: true, subject: { select: { name: true } } } });
  res.status(201).json({ classSubject: link });
});

router.delete("/class-subjects/:id", requirePermission("classes.manage"), async (req, res) => {
  const id = idParam(req);
  assertClassSubjectScope(getAccess(req), id);
  await prisma.classSubject.delete({ where: { id } });
  res.json({ ok: true });
});

// ─── Subjects (school-wide list) ─────────────────────────────────────────────

router.get("/subjects", requirePermission("classes.view", "roles.manage"), async (_req, res) => {
  const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, description: true, _count: { select: { classLinks: true } } } });
  res.json({ subjects: subjects.map((s) => ({ id: s.id, name: s.name, description: s.description, classes: s._count.classLinks })) });
});

const subjectInput = z.object({ name: z.string().trim().min(1).max(80), description: z.string().trim().max(300).nullable().optional() });

router.post("/subjects", requirePermission("classes.manage"), async (req, res) => {
  const data = subjectInput.parse(req.body);
  res.status(201).json({ subject: await prisma.subject.create({ data: { name: data.name, description: data.description ?? null } }) });
});

router.put("/subjects/:id", requirePermission("classes.manage"), async (req, res) => {
  requireUnrestricted(getAccess(req));
  const data = subjectInput.parse(req.body);
  res.json({ subject: await prisma.subject.update({ where: { id: idParam(req) }, data: { name: data.name, description: data.description ?? null } }) });
});

router.delete("/subjects/:id", requirePermission("classes.manage"), async (req, res) => {
  requireUnrestricted(getAccess(req));
  await prisma.subject.delete({ where: { id: idParam(req) } });
  res.json({ ok: true });
});

// ─── Topics ──────────────────────────────────────────────────────────────────

const topicInput = z.object({ name: z.string().trim().min(1).max(120) });

router.post("/class-subjects/:id/topics", requirePermission("classes.manage", "papers.manage", "videos.manage"), async (req, res) => {
  const classSubjectId = idParam(req);
  assertClassSubjectScope(getAccess(req), classSubjectId);
  const { name } = topicInput.parse(req.body);
  res.status(201).json({ topic: await prisma.topic.create({ data: { name, classSubjectId } }) });
});

router.put("/topics/:id", requirePermission("classes.manage"), async (req, res) => {
  const id = idParam(req);
  const topic = await prisma.topic.findUnique({ where: { id } });
  if (!topic) throw notFound("Topic");
  assertClassSubjectScope(getAccess(req), topic.classSubjectId);
  const { name } = topicInput.parse(req.body);
  res.json({ topic: await prisma.topic.update({ where: { id }, data: { name } }) });
});

router.delete("/topics/:id", requirePermission("classes.manage"), async (req, res) => {
  const id = idParam(req);
  const topic = await prisma.topic.findUnique({ where: { id } });
  if (!topic) throw notFound("Topic");
  assertClassSubjectScope(getAccess(req), topic.classSubjectId);
  await prisma.topic.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;

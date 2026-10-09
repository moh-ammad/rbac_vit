// Question papers, their questions, test attempts and result analysis.

import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client.js";
import { badRequest, forbidden, idParam, notFound, queryString } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { getAccess, requirePermission } from "../../middleware/auth.js";
import { type Access, assertClassSubjectScope, can, classSubjectWhere, inClassSubjectScope } from "../../services/access.service.js";
import { analyzeAttempt, analyzePaper, analyzeStudent } from "../../services/analysis.service.js";
import { assertTopicBelongs, classSubjectLabelSelect } from "../../services/content.service.js";

const router = Router();

const paperSelect = {
  id: true, title: true, description: true, durationMinutes: true, isPublished: true, createdAt: true, updatedAt: true,
  classSubject: { select: classSubjectLabelSelect },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { questions: true, attempts: true } },
} satisfies Prisma.QuestionPaperSelect;

async function loadPaper(access: Access, id: string) {
  const paper = await prisma.questionPaper.findUnique({ where: { id }, select: { id: true, classSubjectId: true, isPublished: true, title: true } });
  if (!paper || !inClassSubjectScope(access, paper.classSubjectId)) throw notFound("Question paper");
  if (!paper.isPublished && !can(access, "papers.manage")) throw notFound("Question paper");
  return paper;
}

// ─── Papers ──────────────────────────────────────────────────────────────────

router.get("/papers", requirePermission("papers.view", "papers.manage", "papers.attempt", "results.view"), async (req, res) => {
  const access = getAccess(req);
  const q = queryString(req, "q");
  const classId = queryString(req, "classId");
  const subjectId = queryString(req, "subjectId");
  const manager = can(access, "papers.manage");
  const papers = await prisma.questionPaper.findMany({
    where: {
      AND: [
        classSubjectWhere(access),
        manager ? {} : { isPublished: true },
        classId ? { classSubject: { classId } } : {},
        subjectId ? { classSubject: { subjectId } } : {},
        q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    select: paperSelect,
  });

  // For students: attach their latest attempt per paper.
  let mine = new Map<string, { attemptId: string; percentage: number; tries: number }>();
  if (can(access, "papers.attempt") && papers.length) {
    const attempts = await prisma.testAttempt.findMany({ where: { userId: access.userId, paperId: { in: papers.map((p) => p.id) } }, orderBy: { submittedAt: "desc" }, select: { id: true, paperId: true, percentage: true } });
    for (const a of attempts) {
      const row = mine.get(a.paperId);
      if (row) row.tries += 1; else mine.set(a.paperId, { attemptId: a.id, percentage: Math.round(a.percentage), tries: 1 });
    }
  }
  res.json({ papers: papers.map((p) => ({ ...p, questions: p._count.questions, attempts: p._count.attempts, myLatest: mine.get(p.id) ?? null })) });
});

router.get("/papers/:id", requirePermission("papers.view", "papers.manage", "papers.attempt", "results.view"), async (req, res) => {
  const access = getAccess(req);
  const base = await loadPaper(access, idParam(req));
  const manager = can(access, "papers.manage");
  const paper = await prisma.questionPaper.findUniqueOrThrow({
    where: { id: base.id },
    select: {
      ...paperSelect,
      questions: { orderBy: { order: "asc" }, select: { id: true, prompt: true, options: true, marks: true, order: true, topic: { select: { id: true, name: true } }, ...(manager ? { correctIndex: true, explanation: true } : {}) } },
    },
  });
  // Answers are never sent to people who are about to take the test.
  res.json({ paper: { ...paper, totalMarks: paper.questions.reduce((s, q) => s + q.marks, 0) } });
});

const paperInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  classSubjectId: z.uuid(),
  durationMinutes: z.number().int().min(1).max(600).nullable().optional(),
  isPublished: z.boolean().optional(),
});

router.post("/papers", requirePermission("papers.manage"), async (req, res) => {
  const access = getAccess(req);
  const data = paperInput.parse(req.body);
  assertClassSubjectScope(access, data.classSubjectId);
  const paper = await prisma.questionPaper.create({
    data: { title: data.title, description: data.description ?? null, classSubjectId: data.classSubjectId, durationMinutes: data.durationMinutes ?? null, isPublished: false, createdById: access.userId },
    select: paperSelect,
  });
  res.status(201).json({ paper });
});

router.put("/papers/:id", requirePermission("papers.manage"), async (req, res) => {
  const access = getAccess(req);
  const existing = await loadPaper(access, idParam(req));
  const data = paperInput.parse(req.body);
  assertClassSubjectScope(access, data.classSubjectId);
  if (data.classSubjectId !== existing.classSubjectId) {
    const tagged = await prisma.question.count({ where: { paperId: existing.id, topicId: { not: null } } });
    if (tagged) throw badRequest("Remove topic tags from questions before moving the paper to another subject");
  }
  if (data.isPublished) {
    const count = await prisma.question.count({ where: { paperId: existing.id } });
    if (!count) throw badRequest("Add at least one question before publishing");
  }
  const paper = await prisma.questionPaper.update({
    where: { id: existing.id },
    data: { title: data.title, description: data.description ?? null, classSubjectId: data.classSubjectId, durationMinutes: data.durationMinutes ?? null, ...(data.isPublished === undefined ? {} : { isPublished: data.isPublished }) },
    select: paperSelect,
  });
  res.json({ paper });
});

router.delete("/papers/:id", requirePermission("papers.manage"), async (req, res) => {
  const existing = await loadPaper(getAccess(req), idParam(req));
  await prisma.questionPaper.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

// ─── Questions ───────────────────────────────────────────────────────────────

const questionInput = z.object({
  prompt: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
  correctIndex: z.number().int().min(0),
  marks: z.number().int().min(1).max(100).default(1),
  explanation: z.string().trim().max(2000).nullable().optional(),
  topicId: z.uuid().nullable().optional(),
});

async function validateQuestion(raw: unknown, classSubjectId: string) {
  const data = questionInput.parse(raw);
  if (data.correctIndex >= data.options.length) throw badRequest("Choose which option is correct");
  await assertTopicBelongs(data.topicId, classSubjectId);
  return { prompt: data.prompt, options: data.options, correctIndex: data.correctIndex, marks: data.marks, explanation: data.explanation ?? null, topicId: data.topicId ?? null };
}

router.post("/papers/:id/questions", requirePermission("papers.manage"), async (req, res) => {
  const paper = await loadPaper(getAccess(req), idParam(req));
  const data = await validateQuestion(req.body, paper.classSubjectId);
  const order = await prisma.question.count({ where: { paperId: paper.id } });
  res.status(201).json({ question: await prisma.question.create({ data: { ...data, paperId: paper.id, order } }) });
});

async function loadQuestion(access: Access, id: string) {
  const question = await prisma.question.findUnique({ where: { id }, select: { id: true, paperId: true } });
  if (!question) throw notFound("Question");
  const paper = await loadPaper(access, question.paperId);
  return { question, paper };
}

router.put("/questions/:id", requirePermission("papers.manage"), async (req, res) => {
  const { question, paper } = await loadQuestion(getAccess(req), idParam(req));
  const data = await validateQuestion(req.body, paper.classSubjectId);
  res.json({ question: await prisma.question.update({ where: { id: question.id }, data }) });
});

router.delete("/questions/:id", requirePermission("papers.manage"), async (req, res) => {
  const { question } = await loadQuestion(getAccess(req), idParam(req));
  await prisma.question.delete({ where: { id: question.id } });
  res.json({ ok: true });
});

// ─── Taking a test ───────────────────────────────────────────────────────────

const attemptInput = z.object({
  answers: z.array(z.object({ questionId: z.uuid(), selectedIndex: z.number().int().min(0).nullable() })).max(500),
  startedAt: z.iso.datetime().optional(),
});

router.post("/papers/:id/attempts", requirePermission("papers.attempt"), async (req, res) => {
  const access = getAccess(req);
  const paper = await loadPaper(access, idParam(req));
  if (!paper.isPublished) throw forbidden("This paper is not published yet");
  const data = attemptInput.parse(req.body);
  const questions = await prisma.question.findMany({ where: { paperId: paper.id }, select: { id: true, correctIndex: true, marks: true } });
  if (!questions.length) throw badRequest("This paper has no questions");

  // Grade on the server — the browser never knows the correct answers.
  const chosen = new Map(data.answers.map((a) => [a.questionId, a.selectedIndex]));
  let score = 0;
  const total = questions.reduce((s, q) => s + q.marks, 0);
  const rows = questions.map((q) => {
    const selectedIndex = chosen.get(q.id) ?? null;
    const isCorrect = selectedIndex === q.correctIndex;
    if (isCorrect) score += q.marks;
    return { questionId: q.id, selectedIndex, isCorrect };
  });

  const attempt = await prisma.testAttempt.create({
    data: { paperId: paper.id, userId: access.userId, score, total, percentage: total ? (score / total) * 100 : 0, startedAt: data.startedAt ? new Date(data.startedAt) : null, answers: { create: rows } },
    select: { id: true, score: true, total: true, percentage: true },
  });
  res.status(201).json({ attempt });
});

router.get("/attempts/mine", requirePermission("papers.attempt"), async (req, res) => {
  const access = getAccess(req);
  const attempts = await prisma.testAttempt.findMany({
    where: { userId: access.userId },
    orderBy: { submittedAt: "desc" },
    take: 100,
    select: { id: true, score: true, total: true, percentage: true, submittedAt: true, paper: { select: { id: true, title: true, classSubject: { select: classSubjectLabelSelect } } } },
  });
  res.json({ attempts });
});

router.get("/attempts/:id", requirePermission("papers.attempt", "results.view"), async (req, res) => {
  const access = getAccess(req);
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: idParam(req) },
    select: {
      id: true, score: true, total: true, percentage: true, startedAt: true, submittedAt: true, userId: true,
      user: { select: { id: true, name: true } },
      paper: { select: { id: true, title: true, classSubjectId: true, classSubject: { select: classSubjectLabelSelect } } },
      answers: { select: { questionId: true, selectedIndex: true, isCorrect: true } },
    },
  });
  if (!attempt) throw notFound("Result");
  const own = attempt.userId === access.userId;
  if (!own && !(can(access, "results.view") && inClassSubjectScope(access, attempt.paper.classSubjectId))) throw notFound("Result");

  const questions = await prisma.question.findMany({ where: { paperId: attempt.paper.id }, orderBy: { order: "asc" }, select: { id: true, prompt: true, options: true, correctIndex: true, marks: true, explanation: true, topic: { select: { name: true } } } });
  const review = questions.map((q, i) => {
    const answer = attempt.answers.find((a) => a.questionId === q.id);
    return { number: i + 1, ...q, selectedIndex: answer?.selectedIndex ?? null, isCorrect: answer?.isCorrect ?? false };
  });
  const analysis = await analyzeAttempt(attempt.id, access.classSubjectIds);
  const { answers: _answers, ...rest } = attempt;
  res.json({ attempt: { ...rest, percentage: Math.round(attempt.percentage) }, review, ...analysis });
});

// ─── Analysis ────────────────────────────────────────────────────────────────

router.get("/analysis/me", requirePermission("papers.attempt"), async (req, res) => {
  const access = getAccess(req);
  res.json({ analysis: await analyzeStudent(access.userId, access.classSubjectIds) });
});

router.get("/analysis/students/:id", requirePermission("results.view"), async (req, res) => {
  const access = getAccess(req);
  const student = await prisma.user.findUnique({ where: { id: idParam(req) }, select: { id: true, name: true, email: true } });
  if (!student) throw notFound("Student");
  res.json({ student, analysis: await analyzeStudent(student.id, access.classSubjectIds) });
});

router.get("/papers/:id/results", requirePermission("results.view"), async (req, res) => {
  const paper = await loadPaper(getAccess(req), idParam(req));
  res.json({ paper: { id: paper.id, title: paper.title }, ...(await analyzePaper(paper.id)) });
});

export default router;

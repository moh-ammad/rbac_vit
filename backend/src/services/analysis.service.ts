// Turns test answers into a learning analysis:
//   1. group every answered question by topic (questions are tagged with topics)
//   2. accuracy per topic  →  weak (<60%) / average (60–79%) / strong (≥80%)
//   3. weak topics → recommend videos tagged with the same topic, falling back
//      to other videos of that class-subject when a topic has none yet
//   4. score trend over time and plain-language insights
//
// For the overall analysis only the LATEST attempt of each paper counts, so
// retaking a test after studying replaces the old result.

import { prisma } from "../lib/prisma.js";

export const WEAK_BELOW = 0.6;
export const STRONG_FROM = 0.8;

export type TopicLevel = "weak" | "average" | "strong";

export type TopicStat = {
  key: string;
  topicId: string | null;
  topic: string;
  classSubjectId: string;
  subject: string;
  className: string;
  correct: number;
  total: number;
  marksScored: number;
  marksTotal: number;
  accuracy: number; // 0..1, by marks
  level: TopicLevel;
};

type AnswerRow = {
  isCorrect: boolean;
  question: {
    marks: number;
    topic: { id: string; name: string } | null;
    paper: { classSubject: { id: string; classGroup: { name: string }; subject: { name: string } } };
  };
};

const answerSelect = {
  isCorrect: true,
  question: {
    select: {
      marks: true,
      topic: { select: { id: true, name: true } },
      paper: { select: { classSubject: { select: { id: true, classGroup: { select: { name: true } }, subject: { select: { name: true } } } } } },
    },
  },
} as const;

export const levelFor = (accuracy: number): TopicLevel => (accuracy < WEAK_BELOW ? "weak" : accuracy < STRONG_FROM ? "average" : "strong");

export function topicStats(answers: AnswerRow[]): TopicStat[] {
  const map = new Map<string, TopicStat>();
  for (const a of answers) {
    const cs = a.question.paper.classSubject;
    const key = a.question.topic?.id ?? `general:${cs.id}`;
    const stat = map.get(key) ?? {
      key, topicId: a.question.topic?.id ?? null, topic: a.question.topic?.name ?? `General ${cs.subject.name}`,
      classSubjectId: cs.id, subject: cs.subject.name, className: cs.classGroup.name,
      correct: 0, total: 0, marksScored: 0, marksTotal: 0, accuracy: 0, level: "weak" as TopicLevel,
    };
    stat.total += 1;
    stat.marksTotal += a.question.marks;
    if (a.isCorrect) { stat.correct += 1; stat.marksScored += a.question.marks; }
    map.set(key, stat);
  }
  return [...map.values()]
    .map((s) => { const accuracy = s.marksTotal ? s.marksScored / s.marksTotal : 0; return { ...s, accuracy, level: levelFor(accuracy) }; })
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}

/** Videos for weak topics. `allowedClassSubjectIds` = null means no limit. */
export async function recommendVideos(stats: TopicStat[], allowedClassSubjectIds: string[] | null, perTopic = 3) {
  const weak = stats.filter((s) => s.level === "weak").slice(0, 6);
  if (!weak.length) return [];
  const csIds = [...new Set(weak.map((w) => w.classSubjectId))].filter((id) => allowedClassSubjectIds === null || allowedClassSubjectIds.includes(id));
  if (!csIds.length) return [];
  const videos = await prisma.video.findMany({
    where: { classSubjectId: { in: csIds } },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, url: true, description: true, topicId: true, classSubjectId: true, topic: { select: { name: true } }, classSubject: { select: { subject: { select: { name: true } }, classGroup: { select: { name: true } } } } },
  });

  const used = new Set<string>();
  const out: { video: (typeof videos)[number]; reason: string; topic: string; accuracy: number; match: "topic" | "subject" }[] = [];
  for (const w of weak) {
    if (!csIds.includes(w.classSubjectId)) continue;
    const pct = Math.round(w.accuracy * 100);
    const exact = w.topicId ? videos.filter((v) => v.topicId === w.topicId && !used.has(v.id)).slice(0, perTopic) : [];
    exact.forEach((v) => { used.add(v.id); out.push({ video: v, topic: w.topic, accuracy: w.accuracy, match: "topic", reason: `You scored ${pct}% in ${w.topic}` }); });
    if (exact.length === 0) {
      const fallback = videos.filter((v) => v.classSubjectId === w.classSubjectId && !used.has(v.id)).slice(0, 2);
      fallback.forEach((v) => { used.add(v.id); out.push({ video: v, topic: w.topic, accuracy: w.accuracy, match: "subject", reason: `Related ${w.subject} lesson — you scored ${pct}% in ${w.topic}` }); });
    }
  }
  return out;
}

function insightsFor(stats: TopicStat[], trend: { percentage: number }[]) {
  const lines: string[] = [];
  const weak = stats.filter((s) => s.level === "weak");
  const strong = [...stats].filter((s) => s.level === "strong").sort((a, b) => b.accuracy - a.accuracy);
  if (strong[0]) lines.push(`Strongest area: ${strong[0].topic} (${strong[0].subject}) at ${Math.round(strong[0].accuracy * 100)}%.`);
  if (weak.length) lines.push(`Needs work: ${weak.slice(0, 3).map((w) => `${w.topic} (${Math.round(w.accuracy * 100)}%)`).join(", ")}.`);
  else if (stats.length) lines.push("No weak topics right now — keep it up.");
  if (trend.length >= 4) {
    const recent = trend.slice(-3).reduce((s, t) => s + t.percentage, 0) / 3;
    const earlier = trend.slice(0, -3).reduce((s, t) => s + t.percentage, 0) / (trend.length - 3);
    const diff = Math.round(recent - earlier);
    if (diff >= 5) lines.push(`Improving: your last 3 tests average ${diff} points higher than before.`);
    else if (diff <= -5) lines.push(`Slipping: your last 3 tests average ${Math.abs(diff)} points lower than before.`);
    else lines.push("Scores are steady across recent tests.");
  }
  return lines;
}

/** Overall analysis for one student, limited to class-subjects the viewer may see. */
export async function analyzeStudent(userId: string, viewerClassSubjectIds: string[] | null) {
  const scope = viewerClassSubjectIds === null ? {} : { paper: { classSubjectId: { in: viewerClassSubjectIds } } };
  const attempts = await prisma.testAttempt.findMany({
    where: { userId, ...scope },
    orderBy: { submittedAt: "asc" },
    select: { id: true, paperId: true, percentage: true, score: true, total: true, submittedAt: true, paper: { select: { title: true, classSubject: { select: { subject: { select: { name: true } } } } } } },
  });

  const latestPerPaper = new Map<string, string>();
  for (const a of attempts) latestPerPaper.set(a.paperId, a.id);
  const answers = await prisma.attemptAnswer.findMany({ where: { attemptId: { in: [...latestPerPaper.values()] } }, select: answerSelect });
  const stats = topicStats(answers);

  const trend = attempts.map((a) => ({ attemptId: a.id, paper: a.paper.title, subject: a.paper.classSubject.subject.name, percentage: Math.round(a.percentage), submittedAt: a.submittedAt }));
  const latest = [...latestPerPaper.values()].map((id) => attempts.find((a) => a.id === id)!);
  const average = latest.length ? Math.round(latest.reduce((s, a) => s + a.percentage, 0) / latest.length) : null;

  const bySubject = new Map<string, { subject: string; className: string; marksScored: number; marksTotal: number }>();
  for (const s of stats) {
    const row = bySubject.get(s.classSubjectId) ?? { subject: s.subject, className: s.className, marksScored: 0, marksTotal: 0 };
    row.marksScored += s.marksScored; row.marksTotal += s.marksTotal;
    bySubject.set(s.classSubjectId, row);
  }

  return {
    summary: { testsTaken: attempts.length, papersCovered: latest.length, averagePercentage: average, weakTopics: stats.filter((s) => s.level === "weak").length },
    topics: stats,
    subjects: [...bySubject.entries()].map(([classSubjectId, s]) => ({ classSubjectId, ...s, percentage: s.marksTotal ? Math.round((s.marksScored / s.marksTotal) * 100) : 0 })),
    trend,
    insights: insightsFor(stats, trend),
    recommendations: await recommendVideos(stats, viewerClassSubjectIds),
  };
}

/** Topic breakdown + recommendations for a single attempt. */
export async function analyzeAttempt(attemptId: string, viewerClassSubjectIds: string[] | null) {
  const answers = await prisma.attemptAnswer.findMany({ where: { attemptId }, select: answerSelect });
  const stats = topicStats(answers);
  return { topics: stats, recommendations: await recommendVideos(stats, viewerClassSubjectIds) };
}

/** Class-level analysis of one paper for teachers. */
export async function analyzePaper(paperId: string) {
  const attempts = await prisma.testAttempt.findMany({
    where: { paperId },
    orderBy: { submittedAt: "desc" },
    select: { id: true, userId: true, score: true, total: true, percentage: true, submittedAt: true, user: { select: { id: true, name: true, email: true } } },
  });
  // Latest attempt per student.
  const latest = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) if (!latest.has(a.userId)) latest.set(a.userId, a);
  const latestIds = [...latest.values()].map((a) => a.id);

  const [answers, questions] = await Promise.all([
    prisma.attemptAnswer.findMany({ where: { attemptId: { in: latestIds } }, select: { ...answerSelect, questionId: true, selectedIndex: true } }),
    prisma.question.findMany({ where: { paperId }, orderBy: { order: "asc" }, select: { id: true, prompt: true, options: true, correctIndex: true, topic: { select: { name: true } } } }),
  ]);

  const perQuestion = questions.map((q, index) => {
    const rows = answers.filter((a) => a.questionId === q.id);
    const options = (q.options as string[]) ?? [];
    return {
      number: index + 1, id: q.id, prompt: q.prompt, topic: q.topic?.name ?? null,
      attempts: rows.length,
      correctRate: rows.length ? Math.round((rows.filter((r) => r.isCorrect).length / rows.length) * 100) : null,
      optionCounts: options.map((_, i) => rows.filter((r) => r.selectedIndex === i).length),
      correctIndex: q.correctIndex,
    };
  });

  const pcts = [...latest.values()].map((a) => a.percentage);
  const buckets = [0, 20, 40, 60, 80].map((from) => ({ label: `${from}–${from === 80 ? 100 : from + 19}%`, count: pcts.filter((p) => p >= from && (from === 80 ? p <= 100 : p < from + 20)).length }));

  return {
    summary: {
      students: latest.size,
      attempts: attempts.length,
      average: pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : null,
      highest: pcts.length ? Math.round(Math.max(...pcts)) : null,
      lowest: pcts.length ? Math.round(Math.min(...pcts)) : null,
    },
    students: [...latest.values()].map((a) => ({ attemptId: a.id, user: a.user, score: a.score, total: a.total, percentage: Math.round(a.percentage), submittedAt: a.submittedAt, tries: attempts.filter((x) => x.userId === a.userId).length })).sort((x, y) => y.percentage - x.percentage),
    topics: topicStats(answers),
    questions: perQuestion,
    distribution: buckets,
  };
}

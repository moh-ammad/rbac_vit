import { badRequest } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

/** A topic tag must belong to the same class-subject as the content. */
export async function assertTopicBelongs(topicId: string | null | undefined, classSubjectId: string | null | undefined) {
  if (!topicId) return;
  if (!classSubjectId) throw badRequest("Pick a class and subject before choosing a topic");
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { classSubjectId: true } });
  if (!topic || topic.classSubjectId !== classSubjectId) throw badRequest("That topic does not belong to the chosen subject");
}

/** Shared select for "Class 10 · Physics" labels. */
export const classSubjectLabelSelect = {
  id: true,
  classGroup: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true } },
} as const;

export const PAGE_SIZE = 24;

export function pageArgs(raw: unknown) {
  const page = Math.max(1, Number(raw) || 1);
  return { page, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
}

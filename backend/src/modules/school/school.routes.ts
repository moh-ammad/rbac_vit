import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireActive, requirePermission } from "../../middleware/auth.js";

const router = Router();

// Public-ish: any signed-in active user may read the school name (topbar).
router.get("/school/profile", requireActive, async (_req, res) => {
  res.json({ school: await prisma.school.findFirst() });
});

router.get("/school", requirePermission("school.view", "school.manage"), async (_req, res) => {
  const [school, classes, subjects, roles, usersByStatus, usersByAudience, resources, videos, papers, attempts] = await Promise.all([
    prisma.school.findFirst(),
    prisma.classGroup.count(),
    prisma.subject.count(),
    prisma.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, audience: true, isActive: true, isSuperAdmin: true, _count: { select: { users: true } } } }),
    prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.role.groupBy({ by: ["audience"], _count: { _all: true } }),
    prisma.resource.count(),
    prisma.video.count(),
    prisma.questionPaper.count(),
    prisma.testAttempt.aggregate({ _count: { _all: true }, _avg: { percentage: true } }),
  ]);
  const peopleByAudience = await Promise.all(["STAFF", "TEACHER", "STUDENT"].map(async (audience) => [audience, await prisma.user.count({ where: { status: "ACTIVE", role: { audience: audience as "STAFF" | "TEACHER" | "STUDENT", isSuperAdmin: false } } })] as const));
  res.json({
    school,
    stats: {
      classes, subjects, resources, videos, papers,
      attempts: attempts._count._all,
      averageScore: attempts._avg.percentage === null ? null : Math.round(attempts._avg.percentage),
      users: Object.fromEntries(usersByStatus.map((u) => [u.status, u._count._all])),
      people: Object.fromEntries(peopleByAudience),
      rolesByAudience: Object.fromEntries(usersByAudience.map((r) => [r.audience, r._count._all])),
    },
    roles: roles.map((r) => ({ id: r.id, name: r.name, audience: r.audience, isActive: r.isActive, isSuperAdmin: r.isSuperAdmin, members: r._count.users })),
  });
});

const schoolInput = z.object({
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().max(300).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.email().nullable().optional().or(z.literal("").transform(() => null)),
  website: z.string().trim().max(200).nullable().optional(),
  about: z.string().trim().max(3000).nullable().optional(),
  academicYear: z.string().trim().max(40).nullable().optional(),
});

router.put("/school", requirePermission("school.manage"), async (req, res) => {
  const d = schoolInput.parse(req.body);
  const data = { name: d.name, address: d.address ?? null, phone: d.phone ?? null, email: d.email ?? null, website: d.website ?? null, about: d.about ?? null, academicYear: d.academicYear ?? null };
  const existing = await prisma.school.findFirst({ select: { id: true } });
  const school = existing ? await prisma.school.update({ where: { id: existing.id }, data }) : await prisma.school.create({ data });
  res.json({ school });
});

export default router;

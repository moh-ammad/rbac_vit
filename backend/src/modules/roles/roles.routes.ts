// Roles = name + audience + permissions + class/subject scope.
// Everything here is data created from the Settings page.

import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client.js";
import { PERMISSION_GROUPS, type PermissionKey, isPermissionKey } from "../../config/permissions.js";
import { badRequest, forbidden, idParam, notFound, queryString, slugify } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { getAccess, requirePermission } from "../../middleware/auth.js";
import { type Access, classWhere, inClassScope, inClassSubjectScope } from "../../services/access.service.js";
import { logRoleEvent } from "../../services/audit.service.js";

const router = Router();

const scopeInput = z.array(z.object({
  classId: z.uuid(),
  allSubjects: z.boolean(),
  classSubjectIds: z.array(z.uuid()).default([]),
})).max(200);

const roleInput = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional().nullable(),
  audience: z.enum(["STAFF", "TEACHER", "STUDENT"]),
  isActive: z.boolean().default(true),
  permissions: z.array(z.string()).max(50),
  allClasses: z.boolean().default(false),
  scope: scopeInput.default([]),
});
type RoleInput = z.infer<typeof roleInput>;

const roleSelect = {
  id: true, name: true, slug: true, description: true, audience: true, isSuperAdmin: true, isActive: true, allClasses: true, createdAt: true, updatedAt: true,
  permissions: { select: { permission: true } },
  classes: { select: { classId: true, allSubjects: true, classGroup: { select: { name: true } } } },
  classSubjects: { select: { classSubjectId: true, classSubject: { select: { classId: true, subject: { select: { name: true } } } } } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleSelect;

type RoleRow = Prisma.RoleGetPayload<{ select: typeof roleSelect }>;

function serializeRole(role: RoleRow) {
  return {
    id: role.id, name: role.name, slug: role.slug, description: role.description, audience: role.audience,
    isSuperAdmin: role.isSuperAdmin, isActive: role.isActive, allClasses: role.allClasses,
    createdAt: role.createdAt, updatedAt: role.updatedAt, members: role._count.users,
    permissions: role.permissions.map((p) => p.permission),
    scope: role.classes.map((c) => ({
      classId: c.classId,
      className: c.classGroup.name,
      allSubjects: c.allSubjects,
      classSubjectIds: role.classSubjects.filter((cs) => cs.classSubject.classId === c.classId).map((cs) => cs.classSubjectId),
      subjectNames: role.classSubjects.filter((cs) => cs.classSubject.classId === c.classId).map((cs) => cs.classSubject.subject.name),
    })),
  };
}

/** Stops anyone except the Super Admin from handing out more than they have. */
async function validateGrant(actor: Access, input: RoleInput) {
  const unknown = input.permissions.filter((p) => !isPermissionKey(p));
  if (unknown.length) throw badRequest(`Unknown permission: ${unknown.join(", ")}`);
  const perms = input.permissions as PermissionKey[];

  if (!actor.isSuperAdmin) {
    const missing = perms.filter((p) => !actor.permissions.has(p));
    if (missing.length) throw forbidden(`You cannot grant permissions you do not have: ${missing.join(", ")}`);
    if (input.allClasses && !actor.unrestricted) throw forbidden("You cannot grant access to all classes");
  }

  const classIds = input.scope.map((s) => s.classId);
  if (new Set(classIds).size !== classIds.length) throw badRequest("A class appears twice in the scope");
  const links = await prisma.classSubject.findMany({ where: { classId: { in: classIds } }, select: { id: true, classId: true } });
  const existingClasses = await prisma.classGroup.count({ where: { id: { in: classIds } } });
  if (existingClasses !== classIds.length) throw badRequest("One of the selected classes no longer exists");
  for (const entry of input.scope) {
    if (!inClassScope(actor, entry.classId)) throw forbidden("You can only grant classes you have access to");
    for (const csId of entry.classSubjectIds) {
      const link = links.find((l) => l.id === csId);
      if (!link || link.classId !== entry.classId) throw badRequest("A selected subject does not belong to its class");
      if (!inClassSubjectScope(actor, csId)) throw forbidden("You can only grant subjects you have access to");
    }
    if (entry.allSubjects && actor.classSubjectIds !== null) {
      const all = links.filter((l) => l.classId === entry.classId).map((l) => l.id);
      if (!all.every((id) => inClassSubjectScope(actor, id))) throw forbidden("You can only grant subjects you have access to");
    }
  }
  return perms;
}

async function writeRoleChildren(tx: Prisma.TransactionClient, roleId: string, perms: PermissionKey[], input: RoleInput) {
  await tx.rolePermission.deleteMany({ where: { roleId } });
  await tx.roleClass.deleteMany({ where: { roleId } });
  await tx.roleClassSubject.deleteMany({ where: { roleId } });
  if (perms.length) await tx.rolePermission.createMany({ data: perms.map((permission) => ({ roleId, permission })) });
  if (input.allClasses) return;
  if (input.scope.length) await tx.roleClass.createMany({ data: input.scope.map((s) => ({ roleId, classId: s.classId, allSubjects: s.allSubjects })) });
  const subjects = input.scope.filter((s) => !s.allSubjects).flatMap((s) => s.classSubjectIds);
  if (subjects.length) await tx.roleClassSubject.createMany({ data: subjects.map((classSubjectId) => ({ roleId, classSubjectId })) });
}

function scopeSignature(role: { allClasses: boolean; scope: { classId: string; allSubjects: boolean; classSubjectIds: string[] }[] }) {
  if (role.allClasses) return "ALL";
  return role.scope.map((s) => `${s.classId}:${s.allSubjects ? "*" : [...s.classSubjectIds].sort().join(",")}`).sort().join("|");
}

// ─── Routes ─────────────────────────────────────────────────────────────────

router.get("/permissions", requirePermission("roles.manage"), (_req, res) => {
  res.json({ groups: PERMISSION_GROUPS });
});

// Classes → subjects tree used by the nested checkboxes in Settings.
router.get("/roles/scope-tree", requirePermission("roles.manage"), async (req, res) => {
  const access = getAccess(req);
  const classes = await prisma.classGroup.findMany({
    where: classWhere(access, "id"),
    orderBy: [{ grade: "asc" }, { name: "asc" }],
    select: { id: true, name: true, grade: true, subjects: { orderBy: { subject: { name: "asc" } }, select: { id: true, subject: { select: { id: true, name: true } } } } },
  });
  res.json({
    classes: classes.map((c) => ({
      id: c.id, name: c.name, grade: c.grade,
      subjects: c.subjects.filter((s) => inClassSubjectScope(access, s.id)).map((s) => ({ classSubjectId: s.id, subjectId: s.subject.id, name: s.subject.name })),
    })),
  });
});

router.get("/roles", requirePermission("roles.manage", "users.manage"), async (_req, res) => {
  const roles = await prisma.role.findMany({ orderBy: [{ isSuperAdmin: "desc" }, { name: "asc" }], select: roleSelect });
  res.json({ roles: roles.map(serializeRole) });
});

router.get("/roles/events", requirePermission("roles.manage"), async (req, res) => {
  const roleId = queryString(req, "roleId");
  const events = await prisma.roleEvent.findMany({
    where: roleId ? { roleId } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, roleId: true, roleName: true, action: true, details: true, createdAt: true, actor: { select: { name: true } }, targetUser: { select: { name: true, email: true } } },
  });
  res.json({ events });
});

router.get("/roles/:id", requirePermission("roles.manage"), async (req, res) => {
  const role = await prisma.role.findUnique({ where: { id: idParam(req) }, select: { ...roleSelect, users: { select: { id: true, name: true, email: true, status: true }, orderBy: { name: "asc" } } } });
  if (!role) throw notFound("Role");
  res.json({ role: { ...serializeRole(role), users: role.users } });
});

router.post("/roles", requirePermission("roles.manage"), async (req, res) => {
  const actor = getAccess(req);
  const input = roleInput.parse(req.body);
  const perms = await validateGrant(actor, input);
  const slug = slugify(input.name);
  if (!slug) throw badRequest("Role name needs letters or numbers");

  const role = await prisma.$transaction(async (tx) => {
    const created = await tx.role.create({ data: { name: input.name, slug, description: input.description ?? null, audience: input.audience, isActive: input.isActive, allClasses: input.allClasses } });
    await writeRoleChildren(tx, created.id, perms, input);
    await logRoleEvent(tx, { roleId: created.id, roleName: created.name, action: "CREATED", actorId: actor.userId, details: { audience: input.audience, permissions: perms, allClasses: input.allClasses, classes: input.scope.length } });
    return tx.role.findUniqueOrThrow({ where: { id: created.id }, select: roleSelect });
  });
  res.status(201).json({ role: serializeRole(role) });
});

router.put("/roles/:id", requirePermission("roles.manage"), async (req, res) => {
  const actor = getAccess(req);
  const id = idParam(req);
  const input = roleInput.parse(req.body);
  const existing = await prisma.role.findUnique({ where: { id }, select: roleSelect });
  if (!existing) throw notFound("Role");
  if (existing.isSuperAdmin) throw forbidden("The Super Admin role is locked");
  if (!actor.isSuperAdmin && actor.role?.id === id) throw forbidden("You cannot edit your own role");
  const perms = await validateGrant(actor, input);
  const before = serializeRole(existing);

  const role = await prisma.$transaction(async (tx) => {
    await tx.role.update({ where: { id }, data: { name: input.name, slug: slugify(input.name), description: input.description ?? null, audience: input.audience, isActive: input.isActive, allClasses: input.allClasses } });
    await writeRoleChildren(tx, id, perms, input);
    const after = await tx.role.findUniqueOrThrow({ where: { id }, select: roleSelect });
    const next = serializeRole(after);

    // One history entry per kind of change so the log is easy to read.
    const base = { roleId: id, roleName: next.name, actorId: actor.userId };
    if (before.name !== next.name || before.description !== next.description || before.audience !== next.audience) {
      await logRoleEvent(tx, { ...base, action: "UPDATED", details: { from: { name: before.name, audience: before.audience }, to: { name: next.name, audience: next.audience } } });
    }
    if (before.isActive !== next.isActive) await logRoleEvent(tx, { ...base, action: next.isActive ? "ACTIVATED" : "DEACTIVATED" });
    const added = next.permissions.filter((p) => !before.permissions.includes(p));
    const removed = before.permissions.filter((p) => !next.permissions.includes(p));
    if (added.length || removed.length) await logRoleEvent(tx, { ...base, action: "PERMISSIONS_CHANGED", details: { added, removed } });
    if (scopeSignature(before) !== scopeSignature(next)) {
      await logRoleEvent(tx, { ...base, action: "SCOPE_CHANGED", details: { allClasses: next.allClasses, classes: next.scope.map((s) => (s.allSubjects ? `${s.className} (all subjects)` : `${s.className}: ${s.subjectNames.join(", ") || "class only"}`)) } });
    }
    return after;
  });
  res.json({ role: serializeRole(role) });
});

router.delete("/roles/:id", requirePermission("roles.manage"), async (req, res) => {
  const actor = getAccess(req);
  const id = idParam(req);
  const role = await prisma.role.findUnique({ where: { id }, select: { id: true, name: true, isSuperAdmin: true, users: { select: { id: true } } } });
  if (!role) throw notFound("Role");
  if (role.isSuperAdmin) throw forbidden("The Super Admin role cannot be deleted");
  if (!actor.isSuperAdmin && actor.role?.id === id) throw forbidden("You cannot delete your own role");

  await prisma.$transaction(async (tx) => {
    // Members lose the role and go back to "waiting for a role".
    for (const user of role.users) await logRoleEvent(tx, { roleId: id, roleName: role.name, action: "UNASSIGNED", actorId: actor.userId, targetUserId: user.id, details: { reason: "role deleted" } });
    await tx.user.updateMany({ where: { roleId: id }, data: { roleId: null, status: "PENDING" } });
    await logRoleEvent(tx, { roleId: id, roleName: role.name, action: "DELETED", actorId: actor.userId, details: { members: role.users.length } });
    await tx.role.delete({ where: { id } });
  });
  res.json({ ok: true });
});

export default router;

import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client.js";
import { hashPassword } from "../../lib/auth-tokens.js";
import { HttpError, badRequest, forbidden, idParam, notFound, queryString } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { getAccess, requirePermission } from "../../middleware/auth.js";
import type { Access } from "../../services/access.service.js";
import { logRoleEvent } from "../../services/audit.service.js";

const router = Router();

const userSelect = {
  id: true, name: true, email: true, status: true, createdAt: true,
  role: { select: { id: true, name: true, audience: true, isSuperAdmin: true } },
} satisfies Prisma.UserSelect;

/** Users whose role touches one of the actor's classes (or everyone, if unrestricted). */
function userScopeWhere(access: Access): Prisma.UserWhereInput {
  if (access.unrestricted) return {};
  const classIds = access.classIds ?? [];
  return {
    OR: [
      { id: access.userId },
      { role: { classes: { some: { classId: { in: classIds } } } } },
      { role: { classSubjects: { some: { classSubject: { classId: { in: classIds } } } } } },
    ],
  };
}

/** A non-super-admin may only hand out roles that are no stronger than their own. */
async function assertCanAssignRole(actor: Access, roleId: string) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, name: true, isSuperAdmin: true, isActive: true, allClasses: true, permissions: { select: { permission: true } }, classes: { select: { classId: true } } },
  });
  if (!role) throw notFound("Role");
  if (actor.isSuperAdmin) return role;
  if (role.isSuperAdmin) throw forbidden("Only the Super Admin can assign the Super Admin role");
  const stronger = role.permissions.some((p) => !actor.permissions.has(p.permission as never));
  const wider = (role.allClasses && !actor.unrestricted) || role.classes.some((c) => actor.classIds !== null && !actor.classIds.includes(c.classId));
  if (stronger || wider) throw forbidden("That role has more access than you do");
  return role;
}

async function loadTarget(actor: Access, id: string) {
  const user = await prisma.user.findFirst({ where: { id, ...userScopeWhere(actor) }, select: userSelect });
  if (!user) throw notFound("User");
  if (!actor.isSuperAdmin && user.role?.isSuperAdmin) throw forbidden("Only the Super Admin can change this account");
  return user;
}

router.get("/users", requirePermission("users.view", "users.manage"), async (req, res) => {
  const access = getAccess(req);
  const q = queryString(req, "q");
  const roleId = queryString(req, "roleId");
  const status = queryString(req, "status");
  const where: Prisma.UserWhereInput = {
    AND: [
      userScopeWhere(access),
      q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {},
      roleId === "none" ? { roleId: null } : roleId ? { roleId } : {},
      status === "PENDING" || status === "ACTIVE" || status === "SUSPENDED" ? { status } : {},
    ],
  };
  const users = await prisma.user.findMany({ where, orderBy: [{ status: "asc" }, { name: "asc" }], select: userSelect, take: 500 });
  res.json({ users });
});

router.get("/users/:id/history", requirePermission("users.view", "users.manage"), async (req, res) => {
  const user = await loadTarget(getAccess(req), idParam(req));
  const events = await prisma.roleEvent.findMany({ where: { targetUserId: user.id }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, action: true, roleName: true, createdAt: true, actor: { select: { name: true } } } });
  res.json({ events });
});

const createInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(6).max(100),
  roleId: z.uuid().nullable().optional(),
});

router.post("/users", requirePermission("users.manage"), async (req, res) => {
  const actor = getAccess(req);
  const data = createInput.parse(req.body);
  if (await prisma.user.findUnique({ where: { email: data.email } })) throw new HttpError(409, "An account with this email already exists");
  const role = data.roleId ? await assertCanAssignRole(actor, data.roleId) : null;
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { name: data.name, email: data.email, password: await hashPassword(data.password), roleId: role?.id ?? null, status: role ? "ACTIVE" : "PENDING" }, select: userSelect });
    if (role) await logRoleEvent(tx, { roleId: role.id, roleName: role.name, action: "ASSIGNED", actorId: actor.userId, targetUserId: created.id });
    return created;
  });
  res.status(201).json({ user });
});

const updateInput = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.email().transform((v) => v.toLowerCase()).optional(),
  password: z.string().min(6).max(100).optional(),
  roleId: z.uuid().nullable().optional(),
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]).optional(),
});

router.put("/users/:id", requirePermission("users.manage"), async (req, res) => {
  const actor = getAccess(req);
  const target = await loadTarget(actor, idParam(req));
  const data = updateInput.parse(req.body);
  if (target.id === actor.userId && (data.roleId !== undefined || data.status !== undefined)) throw forbidden("You cannot change your own role or status");

  const update: Prisma.UserUncheckedUpdateInput = {};
  if (data.name) update.name = data.name;
  if (data.email && data.email !== target.email) {
    if (await prisma.user.findUnique({ where: { email: data.email } })) throw new HttpError(409, "That email is already in use");
    update.email = data.email;
  }
  if (data.password) update.password = await hashPassword(data.password);

  let newRole: { id: string; name: string } | null | undefined;
  if (data.roleId !== undefined && data.roleId !== (target.role?.id ?? null)) {
    newRole = data.roleId ? await assertCanAssignRole(actor, data.roleId) : null;
    update.roleId = newRole?.id ?? null;
    // Giving someone a role activates them; removing it sends them back to pending.
    update.status = newRole ? (data.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE") : "PENDING";
  } else if (data.status) {
    if (data.status === "ACTIVE" && !target.role) throw badRequest("Assign a role before activating this account");
    update.status = data.status;
  }

  const user = await prisma.$transaction(async (tx) => {
    const saved = await tx.user.update({ where: { id: target.id }, data: update, select: userSelect });
    if (newRole !== undefined) {
      if (target.role) await logRoleEvent(tx, { roleId: target.role.id, roleName: target.role.name, action: "UNASSIGNED", actorId: actor.userId, targetUserId: target.id });
      if (newRole) await logRoleEvent(tx, { roleId: newRole.id, roleName: newRole.name, action: "ASSIGNED", actorId: actor.userId, targetUserId: target.id });
    }
    return saved;
  });
  res.json({ user });
});

router.delete("/users/:id", requirePermission("users.manage"), async (req, res) => {
  const actor = getAccess(req);
  const target = await loadTarget(actor, idParam(req));
  if (target.id === actor.userId) throw forbidden("You cannot delete your own account");
  if (target.role?.isSuperAdmin) {
    const admins = await prisma.user.count({ where: { role: { isSuperAdmin: true }, status: "ACTIVE" } });
    if (admins <= 1) throw forbidden("The last Super Admin cannot be deleted");
  }
  await prisma.user.delete({ where: { id: target.id } });
  res.json({ ok: true });
});

export default router;

// Single source of truth for "who is this user and what may they touch".
//
// Every request loads the user's role from the database, so changing a role in
// Settings takes effect immediately — nothing is cached in the token.

import type { RoleAudience } from "../../generated/prisma/client.js";
import { ALL_PERMISSIONS, type PermissionKey, isPermissionKey } from "../config/permissions.js";
import { forbidden } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export type Access = {
  userId: string;
  name: string;
  email: string;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  role: { id: string; name: string; slug: string; audience: RoleAudience; isSuperAdmin: boolean; allClasses: boolean; isActive: boolean } | null;
  permissions: Set<PermissionKey>;
  isSuperAdmin: boolean;
  /** true when the user is not limited to particular classes */
  unrestricted: boolean;
  /** classes the user can see; null = all */
  classIds: string[] | null;
  /** class-subjects the user can see; null = all */
  classSubjectIds: string[] | null;
};

export async function loadAccess(userId: string): Promise<Access | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, status: true,
      role: {
        select: {
          id: true, name: true, slug: true, audience: true, isSuperAdmin: true, allClasses: true, isActive: true,
          permissions: { select: { permission: true } },
          classes: { select: { classId: true, allSubjects: true, classGroup: { select: { subjects: { select: { id: true } } } } } },
          classSubjects: { select: { classSubjectId: true, classSubject: { select: { classId: true } } } },
        },
      },
    },
  });
  if (!user) return null;

  const role = user.role;
  const roleUsable = Boolean(role && role.isActive && user.status === "ACTIVE");
  const isSuperAdmin = Boolean(role?.isSuperAdmin && user.status === "ACTIVE");
  const unrestricted = isSuperAdmin || Boolean(roleUsable && role?.allClasses);

  let permissions = new Set<PermissionKey>();
  if (isSuperAdmin) permissions = new Set(ALL_PERMISSIONS);
  else if (roleUsable && role) permissions = new Set(role.permissions.map((p) => p.permission).filter(isPermissionKey));

  let classIds: string[] | null = null;
  let classSubjectIds: string[] | null = null;
  if (!unrestricted) {
    const classSet = new Set<string>();
    const csSet = new Set<string>();
    if (roleUsable && role) {
      for (const rc of role.classes) {
        classSet.add(rc.classId);
        if (rc.allSubjects) rc.classGroup.subjects.forEach((s) => csSet.add(s.id));
      }
      for (const rcs of role.classSubjects) {
        csSet.add(rcs.classSubjectId);
        classSet.add(rcs.classSubject.classId);
      }
    }
    classIds = [...classSet];
    classSubjectIds = [...csSet];
  }

  return {
    userId: user.id, name: user.name, email: user.email, status: user.status,
    role: role ? { id: role.id, name: role.name, slug: role.slug, audience: role.audience, isSuperAdmin: role.isSuperAdmin, allClasses: role.allClasses, isActive: role.isActive } : null,
    permissions, isSuperAdmin, unrestricted, classIds, classSubjectIds,
  };
}

export const can = (access: Access, permission: PermissionKey) => access.permissions.has(permission);

/** Prisma `where` fragment limiting a classSubjectId column to the user's scope. */
export function classSubjectWhere(access: Access) {
  return access.classSubjectIds === null ? {} : { classSubjectId: { in: access.classSubjectIds } };
}

/** Prisma `where` fragment limiting a classId column to the user's scope. */
export function classWhere(access: Access, column: "id" | "classId" = "classId") {
  return access.classIds === null ? {} : { [column]: { in: access.classIds } };
}

export function inClassSubjectScope(access: Access, classSubjectId: string) {
  return access.classSubjectIds === null || access.classSubjectIds.includes(classSubjectId);
}

export function inClassScope(access: Access, classId: string) {
  return access.classIds === null || access.classIds.includes(classId);
}

export function assertClassSubjectScope(access: Access, classSubjectId: string) {
  if (!inClassSubjectScope(access, classSubjectId)) throw forbidden("That class/subject is outside your access");
}

export function assertClassScope(access: Access, classId: string) {
  if (!inClassScope(access, classId)) throw forbidden("That class is outside your access");
}

/** Shape sent to the browser by /api/me. */
export function serializeAccess(access: Access) {
  return {
    id: access.userId,
    name: access.name,
    email: access.email,
    status: access.status,
    role: access.role,
    isSuperAdmin: access.isSuperAdmin,
    unrestricted: access.unrestricted,
    permissions: [...access.permissions],
    classIds: access.classIds,
    classSubjectIds: access.classSubjectIds,
  };
}

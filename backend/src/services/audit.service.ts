import type { Prisma, RoleEventAction } from "../../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

type Db = Prisma.TransactionClient | typeof prisma;

/** Writes one entry to the role history shown on the Settings page. */
export function logRoleEvent(db: Db, event: { roleId: string | null; roleName: string; action: RoleEventAction; actorId: string; targetUserId?: string | null; details?: Prisma.InputJsonValue }) {
  return db.roleEvent.create({
    data: {
      roleId: event.roleId,
      roleName: event.roleName,
      action: event.action,
      actorId: event.actorId,
      targetUserId: event.targetUserId ?? null,
      ...(event.details === undefined ? {} : { details: event.details }),
    },
  });
}

// Seeds exactly ONE thing: the Super Admin role and its account.
// Every other role, class, subject and piece of content is created in the app.
//
// Safe to run more than once. Set these in backend/.env:
//   SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME (optional)
//   SUPER_ADMIN_RESET_PASSWORD=true  → overwrite the password of an existing admin

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "admin@lms.com").toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "admin123";
  const name = process.env.SUPER_ADMIN_NAME ?? "Super Admin";

  const role = await prisma.role.upsert({
    where: { slug: "super-admin" },
    update: { isSuperAdmin: true, isActive: true, allClasses: true },
    create: { name: "Super Admin", slug: "super-admin", description: "Full access to everything. Created by the seed.", audience: "STAFF", isSuperAdmin: true, allClasses: true },
  });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const reset = process.env.SUPER_ADMIN_RESET_PASSWORD === "true";
    await prisma.user.update({ where: { email }, data: { roleId: role.id, status: "ACTIVE", ...(reset ? { password: await bcrypt.hash(password, 10) } : {}) } });
    console.log(`Super admin ${email} already exists — role confirmed${reset ? ", password reset" : ""}.`);
  } else {
    const user = await prisma.user.create({ data: { email, name, password: await bcrypt.hash(password, 10), roleId: role.id, status: "ACTIVE" } });
    await prisma.roleEvent.create({ data: { roleId: role.id, roleName: role.name, action: "ASSIGNED", targetUserId: user.id, details: { by: "seed" } } });
    console.log(`Created super admin ${email}.`);
  }
}

main()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(() => prisma.$disconnect());

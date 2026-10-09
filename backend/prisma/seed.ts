import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import { PrismaClient } from "../generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL!;
const caCertPath = process.env.DATABASE_CA_CERT_PATH;

let sslConfig = undefined;

if (caCertPath) {
  // path.resolve handles both absolute and relative paths safely
  const resolvedPath = path.resolve(process.cwd(), caCertPath);
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`CA certificate not found at: ${resolvedPath}`);
  }

  sslConfig = {
    ca: fs.readFileSync(resolvedPath, "utf-8"),
    rejectUnauthorized: true,
  };
} else {
  console.warn("WARNING: DATABASE_CA_CERT_PATH is not set. SSL verification might fail.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString,
    ssl: sslConfig,
  }),
});

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
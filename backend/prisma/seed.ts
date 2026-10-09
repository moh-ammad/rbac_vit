// Seeds exactly ONE thing: the Super Admin role and account.
// Safe to run more than once.
//
// Environment variables:
// DATABASE_URL
// DATABASE_CA_CERT_PATH
// SUPER_ADMIN_EMAIL
// SUPER_ADMIN_PASSWORD
// SUPER_ADMIN_NAME (optional)
// SUPER_ADMIN_RESET_PASSWORD=true (optional)

import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import { PrismaClient } from "../generated/prisma/client.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

if (!process.env.DATABASE_CA_CERT_PATH) {
  throw new Error("DATABASE_CA_CERT_PATH is not configured");
}

// Read the trusted Aiven CA certificate
const ca = readFileSync(
  process.env.DATABASE_CA_CERT_PATH,
  "utf8"
);

// Remove URL SSL parameters so they don't override adapter SSL settings.
const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.searchParams.delete("sslmode");
databaseUrl.searchParams.delete("sslrootcert");
databaseUrl.searchParams.delete("sslcert");
databaseUrl.searchParams.delete("sslkey");

const adapter = new PrismaPg({
  connectionString: databaseUrl.toString(),
  ssl: {
    ca,
    rejectUnauthorized: true,
  },
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const email = (
    process.env.SUPER_ADMIN_EMAIL ?? "admin@lms.com"
  ).toLowerCase();

  const password =
    process.env.SUPER_ADMIN_PASSWORD ?? "admin123";

  const name =
    process.env.SUPER_ADMIN_NAME ?? "Super Admin";

  const role = await prisma.role.upsert({
    where: { slug: "super-admin" },
    update: {
      isSuperAdmin: true,
      isActive: true,
      allClasses: true,
    },
    create: {
      name: "Super Admin",
      slug: "super-admin",
      description: "Full access to everything. Created by the seed.",
      audience: "STAFF",
      isSuperAdmin: true,
      allClasses: true,
    },
  });

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    const reset =
      process.env.SUPER_ADMIN_RESET_PASSWORD === "true";

    await prisma.user.update({
      where: { email },
      data: {
        roleId: role.id,
        status: "ACTIVE",
        ...(reset
          ? { password: await bcrypt.hash(password, 10) }
          : {}),
      },
    });

    console.log(
      `Super admin ${email} already exists — role confirmed${
        reset ? ", password reset" : ""
      }.`
    );
  } else {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: await bcrypt.hash(password, 10),
        roleId: role.id,
        status: "ACTIVE",
      },
    });

    await prisma.roleEvent.create({
      data: {
        roleId: role.id,
        roleName: role.name,
        action: "ASSIGNED",
        targetUserId: user.id,
        details: { by: "seed" },
      },
    });

    console.log(`Created super admin ${email}.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
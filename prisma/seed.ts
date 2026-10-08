// Demo data for local development.  npm run db:seed   (runs as the owner role; refuses to run in production)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production");

const db = new PrismaClient({ datasourceUrl: process.env.SYSTEM_DATABASE_URL ?? process.env.DATABASE_URL_OWNER });
const PASSWORD = process.env.SEED_PASSWORD ?? "ChangeMe-123456";

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 12);

  await db.user.upsert({
    where: { email: "superadmin@bibliotek.test" },
    update: {},
    create: { role: "SUPER_ADMIN", email: "superadmin@bibliotek.test", fullName: "Platform Operator", passwordHash: hash },
  });

  const tenant = await db.tenant.upsert({
    where: { code: "demo-uni" },
    update: {},
    create: { name: "Demo University", code: "demo-uni", tier: "STANDARD", allowedEmailDomains: ["students.demo.edu"], autoApproveStudents: true },
  });
  const main = await db.branch.upsert({ where: { tenantId_code: { tenantId: tenant.id, code: "MAIN" } }, update: {}, create: { tenantId: tenant.id, name: "Main Campus Library", code: "MAIN" } });
  const sci = await db.branch.upsert({ where: { tenantId_code: { tenantId: tenant.id, code: "SCI" } }, update: {}, create: { tenantId: tenant.id, name: "Science Department Library", code: "SCI" } });

  if ((await db.borrowPolicy.count({ where: { tenantId: tenant.id } })) === 0) {
    await db.borrowPolicy.create({ data: { tenantId: tenant.id, name: "Standard Student Policy" } });
    await db.borrowPolicy.create({ data: { tenantId: tenant.id, name: "Postgraduate", studentType: "POSTGRAD", isDefault: false, freeRentalDays: 30, maxLoansPerUser: 10 } });
  }

  const people = [
    { role: "TENANT_ADMIN", email: "admin@demo.edu", fullName: "Alex Admin" },
    { role: "LIBRARIAN", email: "librarian@demo.edu", fullName: "Lee Librarian" },
    { role: "STUDENT", email: "student@students.demo.edu", fullName: "Sam Student", studentId: "S1001", department: "Year 10" },
    { role: "STUDENT", email: "pg@students.demo.edu", fullName: "Pat Postgrad", studentId: "S2001", department: "Physics", studentType: "POSTGRAD" },
  ] as const;
  for (const p of people) {
    await db.user.upsert({ where: { email: p.email }, update: {}, create: { ...p, tenantId: tenant.id, passwordHash: hash } });
  }

  if ((await db.catalogItem.count({ where: { tenantId: tenant.id } })) === 0) {
    const titles: [string, string, string, string, string, string, string][] = [
      ["Clean Code", "Robert C. Martin", "Computing", "9780132350884", "005.1", "MAIN", "CLEAN-001"],
      ["The Pragmatic Programmer", "Hunt & Thomas", "Computing", "9780135957059", "005.1", "MAIN", "PRAG-001"],
      ["A Brief History of Time", "Stephen Hawking", "Physics", "9780553380163", "523.1", "SCI", "HIST-001"],
      ["Cosmos", "Carl Sagan", "Astronomy", "9780345539434", "520", "SCI", "COSM-001"],
      ["Dune", "Frank Herbert", "Fiction", "9780441172719", "813.54", "MAIN", "DUNE-001"],
    ];
    for (const [title, author, category, isbn, dewey, br, barcode] of titles) {
      const item = await db.catalogItem.create({ data: { tenantId: tenant.id, title, author, category, isbn, deweyCode: dewey, tags: [category.toLowerCase()] } });
      const branchId = br === "MAIN" ? main.id : sci.id;
      await db.bookCopy.create({ data: { tenantId: tenant.id, catalogItemId: item.id, barcode, homeBranchId: branchId, currentBranchId: branchId } });
    }
  }

  console.log(`\nSeeded. Sign in with password "${PASSWORD}":\n  superadmin@bibliotek.test\n  admin@demo.edu\n  librarian@demo.edu\n  student@students.demo.edu\nSchool code: demo-uni\n`);
}

main().finally(() => db.$disconnect());

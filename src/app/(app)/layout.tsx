import { requirePage } from "@/lib/auth/session";
import { HOME } from "@/lib/auth/rbac";
import { AppShell } from "@/components/AppShell";
import type { Role } from "@prisma/client";

const NAV: Record<Role, { href: string; label: string }[]> = {
  STUDENT: [
    { href: "/student", label: "My library" },
    { href: "/student/catalog", label: "Catalog" },
  ],
  LIBRARIAN: [
    { href: "/librarian", label: "Workbench" },
    { href: "/librarian/requests", label: "Requests" },
    { href: "/librarian/fines", label: "Fines" },
    { href: "/librarian/shifts", label: "My shifts" },
    { href: "/librarian/catalog", label: "Catalog" },
  ],
  TENANT_ADMIN: [
    { href: "/admin", label: "Overview" },
    { href: "/admin/imports", label: "Imports" },
    { href: "/admin/roster", label: "Roster" },
    { href: "/admin/policies", label: "Policies" },
    { href: "/admin/settings", label: "Settings" },
    { href: "/librarian", label: "Workbench" },
    { href: "/librarian/requests", label: "Requests" },
    { href: "/librarian/fines", label: "Fines" },
    { href: "/librarian/catalog", label: "Catalog" },
  ],
  SUPER_ADMIN: [
    { href: "/super-admin", label: "Tenants" },
    { href: "/super-admin/tenants/new", label: "Provision" },
    { href: "/super-admin/profile", label: "My profile" },
  ],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage();
  return <AppShell user={{ fullName: user.fullName, role: user.role, tenantName: user.tenantName, home: HOME[user.role] }} nav={NAV[user.role]}>{children}</AppShell>;
}

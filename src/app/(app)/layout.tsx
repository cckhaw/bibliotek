import { requirePage } from "@/lib/auth/session";
import { HOME } from "@/lib/auth/rbac";
import { NavLinks } from "@/components/NavLinks";
import { LogoutButton } from "@/components/LogoutButton";
import Link from "next/link";
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
  return (
    <div className="min-h-dvh md:flex">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:h-dvh md:w-56 md:shrink-0 md:border-b-0 md:border-r dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2 px-4 py-3 md:block">
          <Link href={HOME[user.role]} className="text-lg font-bold tracking-tight">Bibliotek</Link>
          <div className="text-right md:mt-1 md:text-left">
            <p className="max-w-[10rem] truncate text-xs text-slate-500 md:max-w-none">{user.tenantName ?? "Platform"}</p>
          </div>
        </div>
        <nav aria-label="Primary" className="flex gap-1 overflow-x-auto px-3 pb-2 md:flex-col md:overflow-visible md:pb-0">
          <NavLinks items={NAV[user.role]} />
        </nav>
        <div className="hidden px-4 py-4 md:absolute md:bottom-0 md:block md:w-56">
          <p className="truncate text-sm font-medium">{user.fullName}</p>
          <p className="muted mb-2 truncate">{user.role.replace("_", " ").toLowerCase()}</p>
          <LogoutButton />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-2 md:hidden dark:border-slate-800">
          <span className="truncate text-sm">{user.fullName}</span>
          <LogoutButton />
        </header>
        <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

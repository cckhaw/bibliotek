import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import { LogoutButton } from "@/components/LogoutButton";
import { Mark } from "@/components/marketing";

export interface ShellUser { fullName: string; role: string; tenantName: string | null; home: string }

/** The signed-in frame: translucent chrome (top bar on a phone, sidebar on larger screens) around the page content. */
export function AppShell({ user, nav, children }: { user: ShellUser; nav: { href: string; label: string }[]; children: React.ReactNode }) {
  const role = user.role.replace("_", " ").toLowerCase();
  return (
    <div className="min-h-dvh md:flex">
      {/*
        One piece of translucent chrome. On a phone it is a single top bar (brand row + scrolling nav) that content
        scrolls under; on a larger screen it becomes the sidebar. No stacked strips, no hard dividers.
      */}
      <aside className="material edge-fade sticky top-0 z-30 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col md:shadow-[inset_-1px_0_0_var(--hairline)]">
        <div className="flex items-center justify-between gap-3 px-4 pt-3 md:block md:px-5 md:pt-6">
          <div className="min-w-0">
            <Link href={user.home} className="flex items-center gap-2.5 text-lg font-semibold tracking-[-0.015em]" aria-label="Bibliotek home"><Mark className="size-8" />Bibliotek</Link>
            <p className="muted mt-0.5 hidden truncate md:mt-3 md:block">{user.tenantName ?? "Platform"}</p>
          </div>
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <p className="muted max-w-[7.5rem] truncate">{user.tenantName ?? "Platform"}</p>
            <LogoutButton />
          </div>
        </div>
        <NavLinks items={nav}
          className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] md:flex-1 md:flex-col md:overflow-visible md:px-3 md:py-4 [&::-webkit-scrollbar]:hidden" />
        <div className="hidden px-5 pb-6 md:block">
          <p className="truncate text-sm font-medium">{user.fullName}</p>
          <p className="muted mb-3 truncate capitalize">{role}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-5 py-8 sm:px-8 md:py-12">{children}</main>
    </div>
  );
}

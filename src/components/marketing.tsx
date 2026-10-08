import Link from "next/link";
import type { ReactNode } from "react";

export function SiteHeader() {
  const link = "rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white";
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to main content</a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">B</span>Bibliotek
        </Link>
        <nav aria-label="Main" className="hidden items-center md:flex">
          <a className={link} href="#features">Features</a>
          <a className={link} href="#roles">Who it&apos;s for</a>
          <a className={link} href="#plans">Plans</a>
          <a className={link} href="#find">Find a library</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost btn-sm sm:min-h-10 sm:px-4 sm:text-sm">Sign in</Link>
          <Link href="/register" className="btn-primary btn-sm hidden sm:inline-flex sm:min-h-10 sm:px-4 sm:text-sm">Student sign-up</Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const h = "mb-3 text-sm font-semibold";
  const a = "block py-1 text-sm text-slate-600 hover:text-brand-600 dark:text-slate-400";
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <p className="flex items-center gap-2 text-lg font-bold"><span aria-hidden className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white">B</span>Bibliotek</p>
          <p className="muted mt-3 max-w-xs">Library management for schools and universities — every campus, one catalogue.</p>
        </div>
        <div><p className={h}>Platform</p><a className={a} href="#features">Features</a><a className={a} href="#plans">Plans</a><a className={a} href="#roles">Who it&apos;s for</a></div>
        <div><p className={h}>Students</p><Link className={a} href="/register">Register</Link><Link className={a} href="/login">Sign in</Link><a className={a} href="#find">Browse a catalog</a></div>
        <div><p className={h}>Staff</p><Link className={a} href="/login">Librarian &amp; admin sign-in</Link></div>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-500 dark:border-slate-900">© {new Date().getFullYear()} Bibliotek</div>
    </footer>
  );
}

/** Alternating text / visual block, the main rhythm of the page. */
export function Feature({ eyebrow, title, children, visual, flip }: { eyebrow: string; title: string; children: ReactNode; visual: ReactNode; flip?: boolean }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:gap-14 md:py-16">
      <div className={flip ? "md:order-2" : ""}>
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
        <h3 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h3>
        <div className="mt-4 space-y-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
      </div>
      <div className={flip ? "md:order-1" : ""}>{visual}</div>
    </section>
  );
}

export function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5"><svg aria-hidden viewBox="0 0 20 20" className="mt-1 size-4 shrink-0 text-emerald-600" fill="currentColor"><path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7 7a1 1 0 0 1-1.4 0l-3-3a1 1 0 1 1 1.4-1.4L9 11.6l6.3-6.3a1 1 0 0 1 1.4 0Z" /></svg><span>{children}</span></li>
  );
}

/** Mock panel chrome so product "screenshots" can be built from HTML (always sharp, theme-aware, no image files). */
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-brand-900/5 dark:border-slate-800 dark:bg-slate-900" aria-hidden>
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
        <span className="size-2.5 rounded-full bg-red-400" /><span className="size-2.5 rounded-full bg-amber-400" /><span className="size-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 text-xs font-medium text-slate-500">{title}</span>
      </div>
      <div className="space-y-2 p-4 text-sm">{children}</div>
    </div>
  );
}

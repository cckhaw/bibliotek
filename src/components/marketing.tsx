import Link from "next/link";
import type { ReactNode } from "react";

/** Book-and-sapling mark. Decorative: the wordmark beside it carries the name. */
export function Mark({ className = "size-9" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 40 40" className={className} fill="none">
      <rect width="40" height="40" rx="11" fill="var(--e-accent)" />
      <path d="M8 26.5c4-2.2 8.6-2.2 12 .6 3.4-2.8 8-2.8 12-.6V31c-4-2.2-8.6-2.2-12 .6C16.6 28.8 12 28.8 8 31v-4.5Z" fill="#f6f0e1" />
      <path d="M20 25V16" stroke="#f6f0e1" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 17c0-3.6-2.4-5.8-6.2-6 0 3.6 2.4 5.8 6.2 6Z" fill="#c9d6b4" />
      <path d="M20 14.5c0-3 2-5 5.4-5.2 0 3-2 5-5.4 5.2Z" fill="#d4a03c" />
    </svg>
  );
}

export function SiteHeader() {
  const link = "rounded-lg px-3 py-2 text-sm font-medium text-(--e-muted) hover:text-(--e-text)";
  return (
    <header className="sticky top-0 z-20 border-b border-(--e-border) bg-(--e-bg)/90 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-30 focus:rounded focus:bg-(--e-surface) focus:px-3 focus:py-2">Skip to main content</a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Bibliotek home">
          <Mark />
          <span className="font-display text-xl font-semibold tracking-tight">Bibliotek</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center md:flex">
          <a className={link} href="#features">Features</a>
          <a className={link} href="#roles">Who it&apos;s for</a>
          <a className={link} href="#plans">Plans</a>
          <a className={link} href="#find">Find a library</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost btn-sm border-(--e-border) hover:bg-(--e-alt) sm:min-h-10 sm:px-4 sm:text-sm">Sign in</Link>
          <Link href="/register" className="btn-primary btn-sm hidden sm:inline-flex sm:min-h-10 sm:px-4 sm:text-sm">Student sign-up</Link>
        </div>
      </div>
    </header>
  );
}

/** Rolling hills: a soft landscape that grounds the hero and the closing call to action. */
export function Hills({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 1440 220" preserveAspectRatio="none" className={`block w-full ${className}`}>
      <path d="M0 120C180 60 330 70 520 110s360 70 560 20c140-35 270-40 360 0V220H0Z" fill="var(--e-hill-1)" />
      <path d="M0 150c160-50 310-40 470 0s330 60 520 20c170-36 330-30 450 10v40H0Z" fill="var(--e-hill-2)" />
      <path d="M0 180c200-40 360-20 540 10s340 30 520-6c150-30 280-24 380 6v30H0Z" fill="var(--e-hill-3)" />
      <path d="M0 205c220-24 420-14 640 4s420 10 800-8v19H0Z" fill="var(--e-hill-4)" />
    </svg>
  );
}

/** Faint topographic contour lines for the deep-green panels. */
export function Contours() {
  return (
    <svg aria-hidden viewBox="0 0 800 400" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 size-full opacity-[0.16]" fill="none" stroke="var(--e-deep-muted)" strokeWidth="1.2">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path key={i} d={`M-20 ${300 - i * 34}C120 ${240 - i * 30} 230 ${330 - i * 32} 380 ${270 - i * 30}s250-90 440-${20 + i * 6}`} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <ellipse key={`e${i}`} cx="640" cy="110" rx={30 + i * 34} ry={18 + i * 20} />
      ))}
    </svg>
  );
}

export function Leaf({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor"><path d="M20 4C9 4 4 9.5 4 16c0 1.4.3 2.7.8 3.8C6 15.5 9.5 12 14 10c-3 3-5 6-6 10 .7.1 1.4.2 2 .2 6.5 0 10-6 10-16Z" /></svg>
  );
}

/** Alternating text / visual block: the main rhythm of the page. */
export function Feature({ eyebrow, title, children, visual, flip }: { eyebrow: string; title: string; children: ReactNode; visual: ReactNode; flip?: boolean }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-2 md:gap-14 md:py-16">
      <div className={flip ? "md:order-2" : ""}>
        <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-(--e-clay)"><Leaf className="size-4" />{eyebrow}</p>
        <h3 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h3>
        <div className="mt-4 space-y-3 text-base leading-relaxed text-(--e-muted)">{children}</div>
      </div>
      <div className={flip ? "md:order-1" : ""}>{visual}</div>
    </section>
  );
}

export function Check({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5"><Leaf className="mt-1 size-4 shrink-0 text-(--e-accent)" /><span>{children}</span></li>
  );
}

type Tone = "moss" | "ochre" | "clay" | "sand";
const TONES: Record<Tone, string> = {
  moss: "bg-[#c9d6b4] text-[#2f4d2a]",
  ochre: "bg-[#f0d9a0] text-[#2a2619]",
  clay: "bg-[#f3d9cc] text-[#8a4224]",
  sand: "bg-(--e-alt) text-(--e-muted)",
};
export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

/** Mock panel chrome so product "screenshots" are built from HTML: always sharp, theme-aware, no image files. */
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-(--e-border) bg-(--e-surface) shadow-xl shadow-[#2f4d2a]/10" aria-hidden>
      <div className="flex items-center gap-1.5 border-b border-(--e-border) bg-(--e-alt) px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-[#a4502d]" /><span className="size-2.5 rounded-full bg-[#d4a03c]" /><span className="size-2.5 rounded-full bg-[#4d7a3f]" />
        <span className="ml-3 text-xs font-medium text-(--e-muted)">{title}</span>
      </div>
      <div className="space-y-2 p-4 text-sm">{children}</div>
    </div>
  );
}

export function Row({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "good" | "warn" | "bad" | "focus" }) {
  const t = { plain: "bg-(--e-alt)", good: "bg-[#e2e9d6] text-[#2f4d2a]", warn: "bg-[#f6e7c2] text-[#2a2619]", bad: "bg-[#f3d9cc] text-[#8a4224]", focus: "bg-(--e-sage)" }[tone];
  return <div className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${t}`}>{children}</div>;
}

export function SiteFooter() {
  const h = "mb-3 text-sm font-semibold text-(--e-deep-text)";
  const a = "block py-1 text-sm text-(--e-deep-muted) hover:text-white";
  return (
    <footer className="bg-(--e-deep) text-(--e-deep-text)">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-2.5 font-display text-xl font-semibold"><Mark />Bibliotek</p>
          <p className="mt-3 max-w-xs text-sm text-(--e-deep-muted)">Library management for schools and universities: every campus, one catalogue, rooted in your community.</p>
        </div>
        <div><p className={h}>Platform</p><a className={a} href="#features">Features</a><a className={a} href="#plans">Plans</a><a className={a} href="#roles">Who it&apos;s for</a></div>
        <div><p className={h}>Students</p><Link className={a} href="/register">Register</Link><Link className={a} href="/login">Sign in</Link><a className={a} href="#find">Browse a catalog</a></div>
        <div><p className={h}>Staff</p><Link className={a} href="/login">Librarian &amp; admin sign-in</Link></div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-(--e-deep-muted)">© {new Date().getFullYear()} Bibliotek</div>
    </footer>
  );
}

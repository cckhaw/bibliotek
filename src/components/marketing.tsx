import Image from "next/image";
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
    <header className="material edge-fade sticky top-0 z-20 md:after:block">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-30 focus:rounded focus:bg-(--e-surface) focus:px-3 focus:py-2">Skip to main content</a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Bibliotek home">
          <Mark />
          <span className="text-lg font-semibold tracking-[-0.015em]">Bibliotek</span>
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
        <p className="text-sm font-semibold text-(--e-clay)">{eyebrow}</p>
        <h3 className="mt-2 text-3xl font-semibold leading-[1.1] tracking-[-0.025em] sm:text-4xl">{title}</h3>
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

/** A small product caption that sits on a photo, so the picture still says what the product does. */
export function Chip({ children, tone, label }: { children: ReactNode; tone?: Tone; label?: string }) {
  return (
    <div className="flex max-w-full items-center gap-2.5 rounded-xl bg-(--e-surface)/95 px-3 py-2 text-sm text-(--e-text) shadow-lg shadow-black/15 backdrop-blur">
      <span className="min-w-0">{children}</span>
      {tone && label && <Pill tone={tone}>{label}</Pill>}
    </div>
  );
}

/**
 * Real photography in a soft frame. `shape="arch"` gives the hero its arched window.
 * Photos are decorative context; the alt text still describes them for screen-reader users.
 */
export function Photo({ src, alt, width, height, sizes, priority, shape = "round", caption, className = "" }: {
  src: string; alt: string; width: number; height: number; sizes: string; priority?: boolean;
  shape?: "round" | "arch"; caption?: ReactNode; className?: string;
}) {
  return (
    <figure className={`relative mx-auto w-full max-w-md ${className}`}>
      <div className={`overflow-hidden shadow-xl shadow-[#2f4d2a]/15 ring-1 ring-black/5 ${shape === "arch" ? "rounded-t-[999px] rounded-b-[2rem]" : "rounded-[2rem]"}`}>
        <Image src={src} alt={alt} width={width} height={height} sizes={sizes} priority={priority} className="aspect-[10/11] h-auto w-full object-cover" />
      </div>
      {caption && <figcaption className="absolute inset-x-4 bottom-4 flex justify-start">{caption}</figcaption>}
    </figure>
  );
}

export function SiteFooter() {
  const h = "mb-3 text-sm font-semibold text-(--e-deep-text)";
  const a = "block py-1 text-sm text-(--e-deep-muted) hover:text-white";
  return (
    <footer className="bg-(--e-deep) text-(--e-deep-text)">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-2.5 text-lg font-semibold tracking-[-0.015em]"><Mark />Bibliotek</p>
          <p className="mt-3 max-w-xs text-sm text-(--e-deep-muted)">Library management for schools and universities: every campus, one catalogue, rooted in your community.</p>
        </div>
        <div><p className={h}>Platform</p><a className={a} href="#features">Features</a><a className={a} href="#plans">Plans</a><a className={a} href="#roles">Who it&apos;s for</a></div>
        <div><p className={h}>Students</p><Link className={a} href="/register">Register</Link><Link className={a} href="/login">Sign in</Link><a className={a} href="#find">Browse a catalog</a></div>
        <div><p className={h}>Staff</p><Link className={a} href="/login">Librarian &amp; admin sign-in</Link></div>
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-(--e-deep-muted)">© {new Date().getFullYear()} Bibliotek · Photography from <a className="underline hover:text-white" href="https://www.pexels.com" target="_blank" rel="noreferrer">Pexels</a> contributors</div>
    </footer>
  );
}

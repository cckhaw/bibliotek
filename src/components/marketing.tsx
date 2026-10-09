import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Book-and-sapling mark. Decorative: the wordmark beside it carries the name. */
export function Mark({ className = "size-9" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 40 40" className={className} fill="none">
      <rect width="40" height="40" rx="11" fill="var(--tint)" />
      <path d="M8 26.5c4-2.2 8.6-2.2 12 .6 3.4-2.8 8-2.8 12-.6V31c-4-2.2-8.6-2.2-12 .6C16.6 28.8 12 28.8 8 31v-4.5Z" fill="#022c22" />
      <path d="M20 25V16" stroke="#022c22" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 17c0-3.6-2.4-5.8-6.2-6 0 3.6 2.4 5.8 6.2 6Z" fill="#022c22" fillOpacity=".55" />
      <path d="M20 14.5c0-3 2-5 5.4-5.2 0 3-2 5-5.4 5.2Z" fill="#022c22" fillOpacity=".8" />
    </svg>
  );
}

/** The one page width. The header, every section and the footer use it, so their edges line up exactly. */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

export function SiteHeader() {
  const link = "rounded-md px-3 py-1.5 text-sm text-(--e-muted) transition-colors hover:text-(--e-text)";
  return (
    <header className="sticky top-0 z-30 border-b border-(--e-border) bg-(--e-bg)">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-40 focus:rounded-md focus:bg-(--e-field) focus:px-3 focus:py-2">Skip to main content</a>
      <Container>
        <div className="flex h-14 items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Bibliotek home">
            <Mark className="size-7" />
            <span className="text-base font-semibold tracking-[-0.02em]">Bibliotek</span>
          </Link>
          <nav aria-label="Main" className="hidden items-center md:flex">
            <a className={link} href="#features">Features</a>
            <a className={link} href="#roles">Who it&apos;s for</a>
            <a className={link} href="#plans">Plans</a>
            <a className={link} href="#find">Find a library</a>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <Link href="/login" className={link}>Sign in</Link>
            <Link href="/register" className="btn-primary btn-sm sm:min-h-9 sm:px-4 sm:text-sm">Sign up</Link>
          </div>
        </div>
      </Container>
    </header>
  );
}

export function Tick({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3.5 8.5 3 3 6-7" /></svg>
  );
}

export function Check({ children }: { children: ReactNode }) {
  return <li className="flex gap-2.5"><Tick className="mt-0.5 size-4 shrink-0 text-(--e-muted)" /><span>{children}</span></li>;
}

/** Section heading, left-aligned to the grid. */
export function SectionHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      {eyebrow && <p className="text-sm font-medium text-(--e-muted)">{eyebrow}</p>}
      <h2 className="mt-2 text-3xl font-semibold leading-[1.1] tracking-[-0.03em] sm:text-4xl">{title}</h2>
      {children && <p className="mt-4 text-base leading-relaxed text-(--e-muted)">{children}</p>}
    </div>
  );
}

/** Text (5 columns) beside a product preview (7 columns) on the 12-column grid; `flip` swaps the sides. */
export function Feature({ eyebrow, title, children, visual, flip }: { eyebrow: string; title: string; children: ReactNode; visual: ReactNode; flip?: boolean }) {
  return (
    <section className="border-t border-(--e-border)">
      <Container>
        <div className="grid grid-cols-1 items-center gap-8 py-14 lg:grid-cols-12 lg:gap-x-12 lg:py-20">
          <div className={`lg:col-span-5 ${flip ? "lg:order-2" : ""}`}>
            <p className="text-sm font-medium text-(--e-muted)">{eyebrow}</p>
            <h3 className="mt-2 text-3xl font-semibold leading-[1.1] tracking-[-0.03em] sm:text-4xl">{title}</h3>
            <div className="mt-4 space-y-4 text-base leading-relaxed text-(--e-muted)">{children}</div>
          </div>
          <div className={`lg:col-span-7 ${flip ? "lg:order-1" : ""}`}>{visual}</div>
        </div>
      </Container>
    </section>
  );
}

type Tone = "moss" | "ochre" | "clay" | "sand";
const DOTS: Record<Tone, string> = { moss: "bg-(--tint)", ochre: "bg-amber-400", clay: "bg-red-400", sand: "bg-zinc-500" };

/** Status badge: neutral container, sharp 1px border, and a coloured dot. Only the dot carries colour. */
export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-(--e-border) bg-(--e-alt) px-2 py-0.5 text-xs font-medium text-(--e-text)">
      <span aria-hidden className={`size-1.5 rounded-full ${DOTS[tone]}`} />{children}
    </span>
  );
}

/**
 * A product preview: the photo in a flat 1px frame with its status bar directly underneath, inside the same border, so
 * the caption is part of the figure rather than something floating over the picture. Photos are decorative context;
 * the alt text still describes them for screen-reader users.
 */
export function Photo({ src, alt, sizes, priority, caption, status, className = "", frameClassName = "aspect-[16/10]" }: {
  src: string; alt: string; sizes: string; priority?: boolean; caption?: ReactNode; status?: { tone: Tone; label: string };
  className?: string; frameClassName?: string;
}) {
  return (
    <figure className={`flex flex-col overflow-hidden rounded-lg border border-(--e-border) bg-(--e-surface) ${className}`}>
      <div className={`relative w-full ${frameClassName}`}>
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
      {caption && (
        <figcaption className="flex items-center justify-between gap-3 border-t border-(--e-border) px-4 py-3 text-sm">
          <span className="min-w-0 text-(--e-text)">{caption}</span>
          {status && <Pill tone={status.tone}>{status.label}</Pill>}
        </figcaption>
      )}
    </figure>
  );
}

export function SiteFooter() {
  const h = "mb-3 text-sm font-medium text-(--e-text)";
  const a = "block py-1 text-sm text-(--e-muted) transition-colors hover:text-(--e-text)";
  return (
    <footer className="border-t border-(--e-border)">
      <Container>
        <div className="grid grid-cols-1 gap-10 py-12 sm:grid-cols-3 lg:grid-cols-12 lg:gap-x-12">
          <div className="sm:col-span-3 lg:col-span-6">
            <p className="flex items-center gap-2.5 text-base font-semibold tracking-[-0.02em]"><Mark className="size-7" />Bibliotek</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-(--e-muted)">Library management for schools and universities: every campus, one catalogue.</p>
          </div>
          <div className="lg:col-span-2"><p className={h}>Platform</p><a className={a} href="#features">Features</a><a className={a} href="#plans">Plans</a><a className={a} href="#roles">Who it&apos;s for</a></div>
          <div className="lg:col-span-2"><p className={h}>Students</p><Link className={a} href="/register">Sign up</Link><Link className={a} href="/login">Sign in</Link><a className={a} href="#find">Browse a catalog</a></div>
          <div className="lg:col-span-2"><p className={h}>Staff</p><Link className={a} href="/login">Librarian &amp; admin sign-in</Link></div>
        </div>
        <div className="border-t border-(--e-border) py-5 text-xs text-(--e-muted)">© {new Date().getFullYear()} Bibliotek · Photography from <a className="underline underline-offset-2 hover:text-(--e-text)" href="https://www.pexels.com" target="_blank" rel="noreferrer">Pexels</a> contributors</div>
      </Container>
    </footer>
  );
}

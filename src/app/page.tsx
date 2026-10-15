import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserOrNull } from "@/lib/auth/session";
import { HOME } from "@/lib/auth/rbac";
import { TIER_PRESETS } from "@/lib/services/licensing";
import { Check, Container, Feature, Photo, SectionHeading, SiteFooter, SiteHeader, type Hue } from "@/components/marketing";
import { FindLibrary } from "@/components/FindLibrary";
import { PlansAccordion } from "@/components/PlansAccordion";
import type { CSSProperties } from "react";

export const metadata = { title: "Bibliotek — Library management for schools & universities" };

const ROLES: readonly { title: string; text: string; cta: { href: string; label: string }; hue: Hue }[] = [
  { hue: "blue", title: "Students", text: "Search the catalogue, see what's on loan and when it's due, request extensions and check fines, from a phone or laptop.", cta: { href: "/register", label: "Sign up" } },
  { hue: "violet", title: "Librarians", text: "A scanner-first desk for checkouts and returns, an approvals queue, fines you can waive with a reason, and your duty roster.", cta: { href: "/login", label: "Sign in" } },
  { hue: "orange", title: "School admins", text: "Import books and students from CSV, set borrowing rules, manage branches and staff, and publish the librarian roster.", cta: { href: "/login", label: "Sign in" } },
  { hue: "teal", title: "Platform operators", text: "Provision schools, adjust plans and limits, and watch usage and storage across every tenant.", cta: { href: "/login", label: "Operator sign-in" } },
];

const PLANS = [
  { key: "FREE", hue: "teal", name: "Free", blurb: "For a single small library getting started.", points: ["Core catalogue & circulation", "Student self-registration", "Email reminders"] },
  { key: "STANDARD", hue: "blue", name: "Standard", blurb: "For a school or department with several branches.", points: ["Everything in Free", "Multiple branches & cross-branch returns", "Duty roster with email notifications"], featured: true },
  { key: "ENTERPRISE", hue: "violet", name: "Enterprise", blurb: "For universities and large networks.", points: ["Everything in Standard", "Highest capacity limits", "Tenant usage & storage reporting"] },
] as const;

const VALUES: readonly { hue: Hue; title: string; text: string }[] = [
  { hue: "blue", title: "Isolated by school", text: "Each school's data is separated at the database level." },
  { hue: "violet", title: "Many branches, one catalogue", text: "Return a book to any branch of your school." },
  { hue: "orange", title: "Runs itself", text: "Reminders, fines and shift emails run on schedule." },
  { hue: "teal", title: "Works anywhere", text: "Responsive on desktop, tablet and phone." },
];

/** Stagger index for the hero's entrance (see .stagger-in in globals.css). */
const at = (i: number) => ({ "--i": i }) as CSSProperties;

/** Four columns separated by 1px rules. The container's background shows through the 1px gaps, so the dividers stay crisp
 *  at every breakpoint (1, 2 or 4 columns) with no per-cell border bookkeeping. */
const RULED = "grid gap-px overflow-hidden rounded-lg border border-(--e-rule) bg-(--e-rule) sm:grid-cols-2 lg:grid-cols-4";
const CELL = "bg-(--e-bg) p-6";

export default async function Landing() {
  // The public home page must stay up even if the database or a setting is broken: fall back to the signed-out page.
  const user = await getCurrentUserOrNull();
  if (user) redirect(HOME[user.role]);

  return (
    <div className="min-h-dvh font-sans">
      <SiteHeader />
      <main id="main">
        {/* Hero: copy on the left 6 columns, the product preview fills the right 6 to the full height of the block. */}
        <section>
          <Container>
            <div className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-12 lg:items-stretch lg:gap-x-12 lg:py-20">
              <div className="flex flex-col justify-center lg:col-span-6">
                <h1 style={at(0)} className="stagger-in text-5xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-[4.25rem]">
                  A library that <span className="text-(--tint-text)">grows with every campus.</span>
                </h1>
                <p style={at(1)} className="stagger-in mt-6 max-w-xl text-lg leading-relaxed text-(--e-muted)">
                  Catalogue books, check them out with a barcode scan, and let students return them at any branch. Fines, reminders and duty rosters tend themselves.
                </p>
                <div style={at(2)} className="stagger-in mt-8 flex flex-wrap items-center gap-3">
                  <Link href="/register" className="btn-primary min-h-11 px-5 text-base">Sign up</Link>
                  <Link href="/login" className="btn-outline min-h-11 px-5 text-base">Staff sign-in</Link>
                </div>
                <p style={at(3)} className="stagger-in mt-5 max-w-md text-sm leading-relaxed text-(--e-muted)">Students sign up here. Library staff are invited by their school; schools are set up by the platform operator.</p>
              </div>
              <div style={at(1)} className="stagger-in lg:col-span-6">
                <Photo priority src="/photos/hero-shelves.webp" sizes="(min-width: 1024px) 560px, 100vw"
                  alt="A long aisle of tall wooden bookshelves lit by warm hanging lamps"
                  className="h-full" frameClassName="aspect-[4/3] lg:aspect-auto lg:min-h-[24rem] lg:flex-1"
                  caption={<><b className="font-semibold">“Clean Code”</b> returned at Science Library</>} status={{ tone: "ochre", label: "Cross-branch" }} />
              </div>
            </div>
          </Container>
        </section>

        {/* Highlights: four columns, 1px rules. */}
        <section aria-label="Highlights" className="border-t border-(--e-rule)">
          <Container className="py-10">
            <ul className={RULED}>
              {VALUES.map((v) => (
                <li key={v.title} className={`${CELL} reveal`}>
                  <p className="text-base font-medium">{v.title}</p><p className="mt-1.5 text-sm leading-relaxed text-(--e-muted)">{v.text}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <div id="features">
        <Feature hue="blue" eyebrow="Circulation" title="Scan, lend, return — anywhere on campus"
          visual={<Photo src="/photos/ladder-shelves.webp" sizes="(min-width: 1024px) 700px, 100vw" alt="Floor-to-ceiling shelves of colourful books beside a rustic wooden ladder" caption="Returned at Science Library" status={{ tone: "moss", label: "Home branch unchanged" }} />}>
          <p>The librarian desk is built for barcode scanners: scan, hear it confirm, and the cursor is back in the field for the next book.</p>
          <ul className="space-y-2.5 text-sm"><Check>Return a book at a different branch — only its current location changes</Check><Check>Per-student-type loan periods and limits</Check><Check>Extension requests with librarian approval</Check></ul>
        </Feature>

        <Feature flip hue="violet" eyebrow="Catalogue & imports" title="Bring your whole collection in, in minutes"
          visual={<Photo src="/photos/card-catalogue.webp" sizes="(min-width: 1024px) 700px, 100vw" alt="Rows of wooden card-catalogue drawers with labels, topped with desk lamps" caption="1,246 of 1,248 rows ready to import" status={{ tone: "clay", label: "2 to fix" }} />}>
          <p>Upload a CSV, validate it first, and get a report that points at the exact line and column of every problem. Good rows import; bad rows come back for fixing.</p>
          <ul className="space-y-2.5 text-sm"><Check>ISBN-10/13 check-digit validation</Check><Check>Dewey, Library of Congress, genre, subject and tags</Check><Check>Bulk student import with automatic account invitations</Check></ul>
        </Feature>

        <Feature hue="orange" eyebrow="Fines & reminders" title="Overdue handling that runs itself"
          visual={<Photo src="/photos/book-stack.webp" sizes="(min-width: 1024px) 700px, 100vw" alt="A tall stack of books in front of warmly lit library shelves" caption="Reminder emailed automatically" status={{ tone: "clay", label: "3d overdue" }} />}>
          <p>Due-soon and overdue emails go out automatically, fines accrue daily by your rules, and borrowing pauses when unpaid fines reach your limit.</p>
          <ul className="space-y-2.5 text-sm"><Check>Free rental days, grace period, daily rate and cap per policy</Check><Check>Librarians can waive or record payment — every change is audited</Check><Check>Safe to re-run: no duplicate emails or double charges</Check></ul>
        </Feature>

        <Feature flip hue="teal" eyebrow="Rosters" title="Duty rosters your librarians actually receive"
          visual={<Photo src="/photos/reading-room.webp" sizes="(min-width: 1024px) 700px, 100vw" alt="An open book on a light wooden table in a bright library reading area" caption="Roster published, librarians notified" status={{ tone: "moss", label: "Sent" }} />}>
          <p>Draft the week by branch and time, publish when it&apos;s ready, and each librarian gets one email. Change a published shift and they&apos;re told again. Double-booking is blocked.</p>
        </Feature>
        </div>

        {/* Roles: a ruled four-column table, not cards. */}
        <section id="roles" className="border-t border-(--e-rule)">
          <Container className="py-14 lg:py-20">
            <SectionHeading title="A place for everyone in the library">Four role-based portals, one sign-in.</SectionHeading>
            <ul className={`mt-10 ${RULED}`}>
              {ROLES.map((r) => (
                <li key={r.title} className={`${CELL} reveal flex flex-col`}>
                  <h3 className="text-lg font-semibold tracking-[-0.015em]">{r.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-(--e-muted)">{r.text}</p>
                  <Link href={r.cta.href} className={`hue-${r.hue} mt-5 text-sm font-medium text-(--hue-text) underline-offset-4 hover:underline`}>{r.cta.label} →</Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section id="plans" className="border-t border-(--e-rule)">
          <Container className="py-14 lg:py-20">
            <SectionHeading title="Plans that fit your institution">Capacity is licensed by students and book copies. Operators can adjust limits per school at any time.</SectionHeading>
            <div className="reveal mt-10">
              <PlansAccordion defaultIndex={1} plans={PLANS.map((p) => ({
                key: p.key, hue: p.hue, name: p.name, blurb: p.blurb, points: p.points,
                students: TIER_PRESETS[p.key].maxStudents.toLocaleString("en-US"), books: TIER_PRESETS[p.key].maxBooks.toLocaleString("en-US"),
                badge: "featured" in p && p.featured ? "Suggested for schools" : undefined,
              }))} />
            </div>
            <p className="mt-5 text-sm text-(--e-muted)">Plans are assigned by your platform operator when your school is set up.</p>
          </Container>
        </section>

        <section id="find" className="border-t border-(--e-rule)">
          <Container className="py-14 lg:py-20">
            <div className="reveal grid grid-cols-1 items-center gap-8 rounded-lg border border-(--e-rule) bg-(--e-surface) p-6 sm:p-8 lg:grid-cols-12 lg:gap-x-12 lg:p-10">
              <div className="lg:col-span-6">
                <h2 className="text-3xl font-semibold leading-[1.1] tracking-[-0.03em] sm:text-4xl">Looking for a book?</h2>
                <p className="mt-3 text-base leading-relaxed text-(--e-muted)">Enter your school&apos;s code to search its catalogue — no account needed.</p>
              </div>
              <div className="lg:col-span-6">
                <FindLibrary />
                <p className="mt-4 text-sm text-(--e-muted)">New student? <Link href="/register" className="font-medium text-(--e-text) underline underline-offset-4">Create your account</Link></p>
              </div>
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

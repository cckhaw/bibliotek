import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserOrNull } from "@/lib/auth/session";
import { HOME } from "@/lib/auth/rbac";
import { TIER_PRESETS } from "@/lib/services/licensing";
import { Check, Contours, Feature, Hills, Leaf, Panel, Pill, Row, SiteFooter, SiteHeader } from "@/components/marketing";
import { FindLibrary } from "@/components/FindLibrary";

export const metadata = { title: "Bibliotek — Library management for schools & universities" };

const ICONS: Record<string, string[]> = {
  student: ["M12 4 2.5 9 12 14l9.5-5L12 4Z", "M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5", "M21.5 9v6"],
  librarian: ["M4 5h6.5A2.5 2.5 0 0 1 13 7.5V20a2 2 0 0 0-2-1.5H4V5Z", "M20 5h-5a2 2 0 0 0-2 1.6V20a2 2 0 0 1 2-1.5h5V5Z"],
  admin: ["M3.5 20.5V9.5L12 4l8.5 5.5v11", "M9 20.5v-6h6v6", "M3 20.5h18"],
  platform: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", "M3 12h18", "M12 3c3 2.8 3 15.2 0 18", "M12 3c-3 2.8-3 15.2 0 18"],
};

function RoleIcon({ name }: { name: keyof typeof ICONS }) {
  return (
    <span className="grid size-11 place-items-center rounded-xl bg-(--e-sage) text-(--e-accent)">
      <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[name].map((d) => <path key={d} d={d} />)}
      </svg>
    </span>
  );
}

const ROLES = [
  { icon: "student", title: "Students", text: "Search the catalogue, see what's on loan and when it's due, request extensions and check fines, from a phone or laptop.", cta: { href: "/register", label: "Register" } },
  { icon: "librarian", title: "Librarians", text: "A scanner-first desk for checkouts and returns, an approvals queue, fines you can waive with a reason, and your duty roster.", cta: { href: "/login", label: "Sign in" } },
  { icon: "admin", title: "School admins", text: "Import books and students from CSV, set borrowing rules, manage branches and staff, and publish the librarian roster.", cta: { href: "/login", label: "Sign in" } },
  { icon: "platform", title: "Platform operators", text: "Provision schools, adjust plans and limits, and watch usage and storage across every tenant.", cta: { href: "/login", label: "Operator sign-in" } },
] as const;

const PLANS = [
  { key: "FREE", name: "Free", blurb: "For a single small library getting started.", points: ["Core catalogue & circulation", "Student self-registration", "Email reminders"] },
  { key: "STANDARD", name: "Standard", blurb: "For a school or department with several branches.", points: ["Everything in Free", "Multiple branches & cross-branch returns", "Duty roster with email notifications"], featured: true },
  { key: "ENTERPRISE", name: "Enterprise", blurb: "For universities and large networks.", points: ["Everything in Standard", "Highest capacity limits", "Tenant usage & storage reporting"] },
] as const;

const VALUES = [
  ["Rooted in your school", "Each school's data is isolated at the database level"],
  ["Many branches, one catalogue", "Return a book to any branch of your school"],
  ["Looks after itself", "Reminders, fines and shift emails run on schedule"],
  ["Works anywhere", "Responsive on desktop, tablet and phone"],
] as const;

export default async function Landing() {
  // The public home page must stay up even if the database or a setting is broken: fall back to the signed-out page.
  const user = await getCurrentUserOrNull();
  if (user) redirect(HOME[user.role]);

  return (
    <div className="theme-earth min-h-dvh font-sans">
      <SiteHeader />
      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-(--e-sage) to-(--e-bg)">
          <div aria-hidden className="absolute -right-24 -top-24 size-96 rounded-full bg-(--e-hill-1) opacity-60 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 md:grid-cols-2 md:gap-14 md:pb-24 md:pt-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-(--e-border) bg-(--e-surface) px-3 py-1 text-xs font-semibold text-(--e-accent)">
                <Leaf className="size-3.5" /> Built for schools &amp; universities
              </p>
              <h1 className="mt-5 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                A library that <span className="text-(--e-accent)">grows</span> with every campus.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-(--e-muted)">
                Catalogue books, check them out with a barcode scan, and let students return them at any branch. Fines, reminders and duty rosters tend themselves.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="btn-primary min-h-12 px-6 text-base">Student sign-up</Link>
                <Link href="/login" className="btn-ghost min-h-12 border-(--e-border) bg-(--e-surface) px-6 text-base hover:bg-(--e-alt)">Staff sign-in</Link>
              </div>
              <p className="mt-4 text-sm text-(--e-muted)">Library staff are invited by their school. Schools are set up by the platform operator.</p>
            </div>
            <Panel title="Circulation desk — Science Library">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-(--e-alt) p-1 text-center text-xs font-medium"><span className="rounded-md py-1.5 text-(--e-muted)">Checkout</span><span className="rounded-md bg-(--e-surface) py-1.5 shadow-sm">Return</span></div>
              <div className="rounded-lg border-2 border-(--e-accent)/60 px-3 py-2.5 font-mono text-sm">CLEAN-001<span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-(--e-accent) align-middle" /></div>
              <Row tone="good"><span>“Clean Code” returned · Sam Student</span><Pill tone="moss">Done</Pill></Row>
              <Row tone="warn"><span>Returned at another branch — location updated</span><Pill tone="ochre">Cross-branch</Pill></Row>
            </Panel>
          </div>
          <Hills className="relative -mb-px h-16 sm:h-24 md:h-32" />
        </section>

        {/* Values: the forest floor */}
        <section aria-label="Highlights" className="bg-(--e-hill-4) text-(--e-deep-text)">
          <ul className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {VALUES.map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <Leaf className="mt-1 size-5 shrink-0 text-(--e-ochre)" />
                <div><p className="font-display text-lg font-semibold">{t}</p><p className="text-sm text-(--e-deep-muted)">{d}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <div id="features" />
        <Feature eyebrow="Circulation" title="Scan, lend, return — anywhere on campus"
          visual={<Panel title="Cross-branch return"><Row><span>Home branch</span><b>Main Campus Library</b></Row><Row><span>Checked out at</span><b>Main Campus Library</b></Row><Row tone="focus"><span>Returned at</span><b>Science Library</b></Row><p className="px-1 pt-1 text-xs text-(--e-muted)">Current location updated. Home cataloguing unchanged.</p></Panel>}>
          <p>The librarian desk is built for barcode scanners: scan, hear it confirm, and the cursor is back in the field for the next book.</p>
          <ul className="space-y-2"><Check>Return a book at a different branch — only its current location changes</Check><Check>Per-student-type loan periods and limits</Check><Check>Extension requests with librarian approval</Check></ul>
        </Feature>

        <div className="bg-(--e-alt)">
          <Feature flip eyebrow="Catalogue & imports" title="Bring your whole collection in, in minutes"
            visual={<Panel title="Books import — validation"><Row tone="good"><span>1,248 rows ready to import</span><Pill tone="moss">OK</Pill></Row><Row tone="bad"><span>Line 14 · isbn — check digit failed</span></Row><Row tone="bad"><span>Line 87 · branch_code — unknown branch</span></Row></Panel>}>
            <p>Upload a CSV, validate it first, and get a report that points at the exact line and column of every problem. Good rows import; bad rows come back for fixing.</p>
            <ul className="space-y-2"><Check>ISBN-10/13 check-digit validation</Check><Check>Dewey, Library of Congress, genre, subject and tags</Check><Check>Bulk student import with automatic account invitations</Check></ul>
          </Feature>
        </div>

        <Feature eyebrow="Fines & reminders" title="Overdue handling that runs itself"
          visual={<Panel title="Student — My library"><Row><span>The Pragmatic Programmer</span><Pill tone="ochre">Due in 2d</Pill></Row><Row><span>Cosmos</span><Pill tone="clay">3d overdue</Pill></Row><Row><span>Unpaid fines</span><b>$1.00</b></Row></Panel>}>
          <p>Due-soon and overdue emails go out automatically, fines accrue daily by your rules, and borrowing pauses when unpaid fines reach your limit.</p>
          <ul className="space-y-2"><Check>Free rental days, grace period, daily rate and cap per policy</Check><Check>Librarians can waive or record payment — every change is audited</Check><Check>Safe to re-run: no duplicate emails or double charges</Check></ul>
        </Feature>

        <div className="bg-(--e-alt)">
          <Feature flip eyebrow="Rosters" title="Duty rosters your librarians actually receive"
            visual={<Panel title="Week of Oct 5"><Row><span>Mon · Lee</span><span className="text-(--e-muted)">08:00–12:00 · Main</span></Row><Row><span>Tue · Lee</span><span className="text-(--e-muted)">13:00–17:00 · Science</span></Row><Row tone="good"><span>Published — librarians notified</span><Pill tone="moss">Sent</Pill></Row></Panel>}>
            <p>Draft the week by branch and time, publish when it&apos;s ready, and each librarian gets one email. Change a published shift and they&apos;re told again. Double-booking is blocked.</p>
          </Feature>
        </div>

        {/* Roles */}
        <section id="roles" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="mx-auto max-w-2xl text-center"><h2 className="font-display text-4xl font-semibold tracking-tight">A place for everyone in the library</h2><p className="mt-3 text-base text-(--e-muted)">Four role-based portals, one sign-in.</p></div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.title} className="flex flex-col rounded-2xl border border-(--e-border) bg-(--e-surface) p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#2f4d2a]/10">
                <RoleIcon name={r.icon} />
                <h3 className="mt-4 font-display text-xl font-semibold">{r.title}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-(--e-muted)">{r.text}</p>
                <Link href={r.cta.href} className="mt-4 text-sm font-semibold text-(--e-clay) hover:underline">{r.cta.label} →</Link>
              </div>
            ))}
          </div>
        </section>

        {/* Plans */}
        <section id="plans" className="bg-(--e-alt) py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center"><h2 className="font-display text-4xl font-semibold tracking-tight">Plans that fit your institution</h2><p className="mt-3 text-base text-(--e-muted)">Capacity is licensed by students and book copies. Operators can adjust limits per school at any time.</p></div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {PLANS.map((p) => {
                const featured = "featured" in p && p.featured;
                return (
                  <div key={p.key} className={`flex flex-col rounded-2xl border bg-(--e-surface) p-6 ${featured ? "border-(--e-accent) ring-2 ring-(--e-accent)" : "border-(--e-border)"}`}>
                    {featured && <span className="mb-2 w-fit"><Pill tone="ochre">Suggested for schools</Pill></span>}
                    <h3 className="font-display text-2xl font-semibold">{p.name}</h3><p className="text-sm text-(--e-muted)">{p.blurb}</p>
                    <p className="mt-5 font-display text-3xl font-semibold">{TIER_PRESETS[p.key].maxStudents.toLocaleString()}<span className="ml-1.5 font-sans text-sm font-normal text-(--e-muted)">students</span></p>
                    <p className="font-display text-3xl font-semibold">{TIER_PRESETS[p.key].maxBooks.toLocaleString()}<span className="ml-1.5 font-sans text-sm font-normal text-(--e-muted)">book copies</span></p>
                    <ul className="mt-5 flex-1 space-y-2 text-sm text-(--e-muted)">{p.points.map((x) => <Check key={x}>{x}</Check>)}</ul>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 text-center text-sm text-(--e-muted)">Plans are assigned by your platform operator when your school is set up.</p>
          </div>
        </section>

        {/* Find a library + closing call to action */}
        <section id="find" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-(--e-deep) p-6 text-(--e-deep-text) sm:p-12">
            <Contours />
            <div className="relative grid items-center gap-8 md:grid-cols-2">
              <div>
                <h2 className="font-display text-4xl font-semibold tracking-tight">Looking for a book?</h2>
                <p className="mt-3 text-(--e-deep-muted)">Enter your school&apos;s code to search its catalogue — no account needed.</p>
              </div>
              <div>
                <FindLibrary tone="onDark" />
                <p className="mt-4 text-sm text-(--e-deep-muted)">New student? <Link href="/register" className="font-semibold text-(--e-deep-text) underline">Create your account</Link></p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

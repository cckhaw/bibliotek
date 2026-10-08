import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { HOME } from "@/lib/auth/rbac";
import { TIER_PRESETS } from "@/lib/services/licensing";
import { Check, Feature, Panel, SiteFooter, SiteHeader } from "@/components/marketing";
import { FindLibrary } from "@/components/FindLibrary";

export const metadata = { title: "Bibliotek — Library management for schools & universities" };

const row = "flex items-center justify-between gap-3 rounded-lg px-3 py-2";

const ROLES = [
  { icon: "🎓", title: "Students", text: "Search the catalogue, see what's on loan and when it's due, request extensions and check fines — from a phone or laptop.", cta: { href: "/register", label: "Register" } },
  { icon: "📚", title: "Librarians", text: "A scanner-first desk for checkouts and returns, an approvals queue, fines you can waive with a reason, and your duty roster.", cta: { href: "/login", label: "Sign in" } },
  { icon: "🏫", title: "School admins", text: "Import books and students from CSV, set borrowing rules, manage branches and staff, and publish the librarian roster.", cta: { href: "/login", label: "Sign in" } },
  { icon: "🛰️", title: "Platform operators", text: "Provision schools, adjust plans and limits, and watch usage and storage across every tenant.", cta: { href: "/login", label: "Operator sign-in" } },
];

const PLANS = [
  { key: "FREE", name: "Free", blurb: "For a single small library getting started.", points: ["Core catalogue & circulation", "Student self-registration", "Email reminders"] },
  { key: "STANDARD", name: "Standard", blurb: "For a school or department with several branches.", points: ["Everything in Free", "Multiple branches & cross-branch returns", "Duty roster with email notifications"], featured: true },
  { key: "ENTERPRISE", name: "Enterprise", blurb: "For universities and large networks.", points: ["Everything in Standard", "Highest capacity limits", "Tenant usage & storage reporting"] },
] as const;

export default async function Landing() {
  const user = await getCurrentUser();
  if (user) redirect(HOME[user.role]);

  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-gradient-to-b from-brand-50 to-transparent dark:from-brand-900/20" />
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-12 sm:px-6 md:grid-cols-2 md:gap-14 md:pb-20 md:pt-20">
            <div>
              <p className="inline-flex items-center rounded-full border border-brand-100 bg-white px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-900 dark:bg-slate-900 dark:text-brand-100">Built for schools &amp; universities</p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">One library system for <span className="text-brand-600">every campus</span>.</h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">Catalogue books, check them out with a barcode scan, and let students return them at any branch. Fines, reminders and duty rosters run themselves.</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/register" className="btn-primary min-h-12 px-6 text-base">Student sign-up</Link>
                <Link href="/login" className="btn-ghost min-h-12 px-6 text-base">Staff sign-in</Link>
              </div>
              <p className="muted mt-4">Library staff are invited by their school. Schools are set up by the platform operator.</p>
            </div>
            <Panel title="Circulation desk — Science Library">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-center text-xs font-medium dark:bg-slate-800"><span className="rounded-md py-1.5 text-slate-500">Checkout</span><span className="rounded-md bg-white py-1.5 shadow dark:bg-slate-950">Return</span></div>
              <div className="rounded-lg border-2 border-brand-600/60 px-3 py-2.5 font-mono text-sm">CLEAN-001<span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-brand-600 align-middle" /></div>
              <div className={`${row} bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200`}><span>“Clean Code” returned · Sam Student</span><span className="badge-green">Done</span></div>
              <div className={`${row} bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200`}><span>Returned at another branch — location updated</span><span className="badge-amber">Cross-branch</span></div>
            </Panel>
          </div>
        </section>

        {/* Value strip */}
        <section aria-label="Highlights" className="border-y border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <ul className="mx-auto grid max-w-6xl gap-px px-4 py-6 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {[["Multi-tenant", "Each school's data is isolated at the database level"], ["Multi-branch", "Return a book to any branch of your school"], ["Automated", "Reminders, fines and shift emails run on schedule"], ["Any device", "Responsive on desktop, tablet and phone"]].map(([t, d]) => (
              <li key={t} className="px-2 py-3"><p className="font-semibold">{t}</p><p className="muted">{d}</p></li>
            ))}
          </ul>
        </section>

        <div id="features" />
        <Feature eyebrow="Circulation" title="Scan, lend, return — anywhere on campus"
          visual={<Panel title="Cross-branch return"><div className={`${row} bg-slate-50 dark:bg-slate-800`}><span>Home branch</span><b>Main Campus Library</b></div><div className={`${row} bg-slate-50 dark:bg-slate-800`}><span>Checked out at</span><b>Main Campus Library</b></div><div className={`${row} bg-brand-50 dark:bg-brand-900/30`}><span>Returned at</span><b>Science Library</b></div><p className="muted px-1 pt-1">Current location updated. Home cataloguing unchanged.</p></Panel>}>
          <p>The librarian desk is built for barcode scanners: scan, hear it confirm, and the cursor is back in the field for the next book.</p>
          <ul className="space-y-2"><Check>Return a book at a different branch — only its current location changes</Check><Check>Per-student-type loan periods and limits</Check><Check>Extension requests with librarian approval</Check></ul>
        </Feature>

        <div className="bg-slate-100/60 dark:bg-slate-900/40">
          <Feature flip eyebrow="Catalogue & imports" title="Bring your whole collection in minutes"
            visual={<Panel title="Books import — validation"><div className={`${row} bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200`}><span>1,248 rows ready to import</span><span className="badge-green">OK</span></div><div className={`${row} bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200`}><span>Line 14 · isbn — check digit failed</span></div><div className={`${row} bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200`}><span>Line 87 · branch_code — unknown branch</span></div></Panel>}>
            <p>Upload a CSV, validate it first, and get a report that points at the exact line and column of every problem. Good rows import; bad rows come back for fixing.</p>
            <ul className="space-y-2"><Check>ISBN-10/13 check-digit validation</Check><Check>Dewey, Library of Congress, genre, subject and tags</Check><Check>Bulk student import with automatic account invitations</Check></ul>
          </Feature>
        </div>

        <Feature eyebrow="Fines & reminders" title="Overdue handling that runs itself"
          visual={<Panel title="Student — My library"><div className={`${row} bg-slate-50 dark:bg-slate-800`}><span>The Pragmatic Programmer</span><span className="badge-amber">Due in 2d</span></div><div className={`${row} bg-slate-50 dark:bg-slate-800`}><span>Cosmos</span><span className="badge-red">3d overdue</span></div><div className={`${row} bg-slate-50 dark:bg-slate-800`}><span>Unpaid fines</span><b>$1.00</b></div></Panel>}>
          <p>Due-soon and overdue emails go out automatically, fines accrue daily by your rules, and borrowing pauses when unpaid fines reach your limit.</p>
          <ul className="space-y-2"><Check>Free rental days, grace period, daily rate and cap per policy</Check><Check>Librarians can waive or record payment — every change is audited</Check><Check>Safe to re-run: no duplicate emails or double charges</Check></ul>
        </Feature>

        <div className="bg-slate-100/60 dark:bg-slate-900/40">
          <Feature flip eyebrow="Rosters" title="Duty rosters your librarians actually receive"
            visual={<Panel title="Week of Oct 5"><div className={`${row} bg-slate-50 dark:bg-slate-800`}><span>Mon · Lee</span><span className="muted">08:00–12:00 · Main</span></div><div className={`${row} bg-slate-50 dark:bg-slate-800`}><span>Tue · Lee</span><span className="muted">13:00–17:00 · Science</span></div><div className={`${row} bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200`}><span>Published — librarians notified</span><span className="badge-green">Sent</span></div></Panel>}>
            <p>Draft the week by branch and time, publish when it&apos;s ready, and each librarian gets one email. Change a published shift and they&apos;re told again. Double-booking is blocked.</p>
          </Feature>
        </div>

        {/* Roles */}
        <section id="roles" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="mx-auto max-w-2xl text-center"><h2 className="text-3xl font-bold tracking-tight">A workspace for everyone in the library</h2><p className="muted mt-3 text-base">Four role-based portals, one sign-in.</p></div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <div key={r.title} className="card flex flex-col"><span aria-hidden className="text-3xl">{r.icon}</span><h3 className="mt-3 font-semibold">{r.title}</h3><p className="muted mt-1 flex-1 text-sm leading-relaxed">{r.text}</p><Link href={r.cta.href} className="mt-4 text-sm font-semibold text-brand-600 hover:underline">{r.cta.label} →</Link></div>
            ))}
          </div>
        </section>

        {/* Plans */}
        <section id="plans" className="bg-slate-100/60 py-14 dark:bg-slate-900/40 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center"><h2 className="text-3xl font-bold tracking-tight">Plans sized to your institution</h2><p className="muted mt-3 text-base">Capacity is licensed by students and book copies. Operators can adjust limits per school at any time.</p></div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {PLANS.map((p) => {
                const featured = "featured" in p && p.featured;
                return (
                  <div key={p.key} className={`card flex flex-col ${featured ? "ring-2 ring-brand-600" : ""}`}>
                    {featured && <span className="badge mb-2 w-fit bg-brand-600 text-white">Most schools</span>}
                    <h3 className="text-lg font-semibold">{p.name}</h3><p className="muted">{p.blurb}</p>
                    <p className="mt-4 text-2xl font-bold">{TIER_PRESETS[p.key].maxStudents.toLocaleString()}<span className="muted ml-1 text-sm font-normal">students</span></p>
                    <p className="text-2xl font-bold">{TIER_PRESETS[p.key].maxBooks.toLocaleString()}<span className="muted ml-1 text-sm font-normal">book copies</span></p>
                    <ul className="mt-4 flex-1 space-y-2 text-sm">{p.points.map((x) => <Check key={x}>{x}</Check>)}</ul>
                  </div>
                );
              })}
            </div>
            <p className="muted mt-6 text-center">Plans are assigned by your platform operator when your school is set up.</p>
          </div>
        </section>

        {/* Find a library + final CTA */}
        <section id="find" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="grid items-center gap-8 rounded-3xl bg-brand-900 p-6 text-white sm:p-10 md:grid-cols-2">
            <div><h2 className="text-3xl font-bold tracking-tight">Looking for a book?</h2><p className="mt-3 text-brand-100">Enter your school&apos;s code to search its catalogue — no account needed.</p></div>
            <div className="[&_.input]:border-transparent"><FindLibrary /><p className="mt-4 text-sm text-brand-100">New student? <Link href="/register" className="font-semibold underline">Create your account</Link></p></div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

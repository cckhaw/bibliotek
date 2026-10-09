import type { ReactNode } from "react";

export const money = (v: unknown) => Number(v ?? 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
export const fmtDate = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (d: Date | string) => new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function Badge({ tone, children }: { tone: "green" | "amber" | "red" | "gray"; children: ReactNode }) {
  return <span className={`badge-${tone}`}>{children}</span>;
}

export function LoanBadge({ dueDate, returnedAt }: { dueDate: Date; returnedAt: Date | null }) {
  if (returnedAt) return <Badge tone="gray">Returned</Badge>;
  const days = Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return <Badge tone="red">{-days}d overdue</Badge>;
  if (days <= 2) return <Badge tone="amber">Due {days === 0 ? "today" : `in ${days}d`}</Badge>;
  return <Badge tone="green">On loan</Badge>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "red" }) {
  return (
    <div className="card">
      <p className="muted">{label}</p>
      <p className={`mt-2 text-[1.75rem] leading-none font-semibold tracking-[-0.022em] tabular-nums ${tone === "red" ? "text-red-600 dark:text-red-400" : ""}`}>{value}</p>
      {sub && <p className="muted mt-0.5">{sub}</p>}
    </div>
  );
}

export function Meter({ label, used, limit, disabled }: { label: string; used: number; limit: number; disabled?: boolean }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const tone = pct >= 100 ? "bg-red-500" : pct >= 85 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="mb-1 flex justify-between text-sm"><span>{label}{disabled && " (not enforced)"}</span><span className="tabular-nums">{used.toLocaleString()} / {limit.toLocaleString()}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        {/* scaleX, not width: the bar animates on the compositor and springs to a new value from wherever it is. */}
        <div data-slide className={`h-full w-full origin-left ${tone}`} style={{ transform: `scaleX(${pct / 100})`, transitionProperty: "transform" }} />
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted py-6 text-center">{children}</p>;
}

export function bytes(n: number | null) {
  if (n == null) return "—";
  const u = ["B", "KB", "MB", "GB"]; let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
}

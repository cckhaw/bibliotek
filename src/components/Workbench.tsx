"use client";
import { useRef, useState } from "react";

interface Branch { id: string; name: string }
interface Entry { id: number; kind: "checkout" | "return"; ok: boolean; text: string; warn?: boolean }

/**
 * Scanner-first workflow: USB/Bluetooth barcode scanners type the code and press Enter, so focus returns to
 * the barcode field after every transaction. The chosen branch is where the physical scan happens.
 */
export function Workbench({ branches, defaultBranchId }: { branches: Branch[]; defaultBranchId: string }) {
  const [mode, setMode] = useState<"checkout" | "return">("checkout");
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [log, setLog] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const barcode = useRef<HTMLInputElement>(null);
  const borrower = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = barcode.current?.value.trim();
    const who = borrower.current?.value.trim();
    if (!code || (mode === "checkout" && !who)) return;
    setBusy(true);
    const res = await fetch(`/api/circulation/${mode}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(mode === "checkout" ? { branchId, barcode: code, borrower: who } : { branchId, barcode: code }),
    });
    const d = await res.json().catch(() => ({}));
    let entry: Entry;
    if (!res.ok) entry = { id: ++seq.current, kind: mode, ok: false, text: `${code}: ${d?.error?.message ?? "Failed"}` };
    else if (mode === "checkout") entry = { id: ++seq.current, kind: mode, ok: true, text: `“${d.title}” → ${d.borrower}, due ${new Date(d.dueDate).toLocaleDateString()}` };
    else {
      const bits = [`“${d.title}” returned (${d.borrower?.fullName})`];
      if (d.crossBranch) bits.push("from another branch — location updated, home branch unchanged");
      if (d.fine) bits.push(`FINE ${d.fine.amount} for ${d.fine.daysOverdue} day(s)`);
      entry = { id: ++seq.current, kind: mode, ok: true, warn: !!d.fine, text: bits.join(" · ") };
    }
    setLog((l) => [entry, ...l].slice(0, 30));
    setBusy(false);
    if (barcode.current) barcode.current.value = "";
    barcode.current?.focus();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <form onSubmit={submit} className="card space-y-4 lg:col-span-2">
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {(["checkout", "return"] as const).map((m) => (
            <button type="button" role="tab" aria-selected={mode === m} key={m} onClick={() => { setMode(m); setTimeout(() => barcode.current?.focus(), 0); }}
              className={`rounded-md py-2 text-sm font-medium capitalize ${mode === m ? "bg-white shadow dark:bg-slate-950" : "text-slate-500"}`}>{m}</button>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="branch">This desk is at</label>
          <select id="branch" className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        {mode === "checkout" && (
          <div>
            <label className="label" htmlFor="borrower">Student ID or email</label>
            <input id="borrower" ref={borrower} className="input" autoComplete="off" required placeholder="Scan card or type ID" />
            <p className="muted mt-1">Stays filled so you can check out several books in a row.</p>
          </div>
        )}
        <div>
          <label className="label" htmlFor="barcode">Book barcode</label>
          <input id="barcode" ref={barcode} className="input text-lg" autoFocus autoComplete="off" required inputMode="text" placeholder="Scan barcode…" />
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Processing…" : mode === "checkout" ? "Check out" : "Return"}</button>
      </form>

      <section className="card lg:col-span-3" aria-live="polite">
        <h2 className="h2">Session activity</h2>
        {log.length === 0 ? <p className="muted">Transactions you process will appear here.</p> : (
          <ul className="space-y-2">
            {log.map((l) => (
              <li key={l.id} className={`rounded-lg border px-3 py-2 text-sm ${!l.ok ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" : l.warn ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200" : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"}`}>
                <span className="mr-2 text-xs font-semibold uppercase">{l.kind}</span>{l.text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

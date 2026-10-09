"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";

/** "Suspend this tenant? All users are signed out." -> title "Suspend this tenant?", message "All users are signed out." */
function splitQuestion(text: string): { title: string; message?: string } {
  const m = text.match(/^(.*?\?)\s+(\S[\s\S]*)$/);
  return m ? { title: m[1], message: m[2] } : text.trim().endsWith("?") ? { title: text } : { title: "Please confirm", message: text };
}

/**
 * One-click POST/DELETE. A confirmation, or a required reason (e.g. fine waivers), opens a sheet instead of the browser's
 * blocking dialogs: it springs in from the button, can be dismissed with Esc / the scrim / a swipe, shows errors inline and
 * keeps the safe choice focused for destructive actions.
 */
export function ActionButton({
  url, method = "POST", body, label, variant = "ghost", confirmText, askReason, confirmLabel,
}: {
  url: string; method?: "POST" | "DELETE" | "PUT" | "PATCH"; body?: Record<string, unknown>; label: string;
  variant?: "primary" | "ghost" | "danger"; confirmText?: string; askReason?: string;
  /** Label of the confirm button inside the sheet. Defaults to the button label, or "Delete" for the ✕ icon button. */
  confirmLabel?: string;
}) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonErr, setReasonErr] = useState<string | null>(null);

  async function run(extra: Record<string, unknown> = {}): Promise<boolean> {
    setBusy(true); setErr(null); setOk(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, ...extra }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d?.error?.message ?? "Failed"); return false; }
      if (d?.message) setOk(d.message);
      router.refresh();
      return true;
    } catch {
      setErr("Network error. Please try again."); return false;
    } finally { setBusy(false); }
  }

  const needsSheet = Boolean(confirmText || askReason);
  const q = askReason ? { title: askReason.replace(/[:：]\s*$/, ""), message: confirmText } : splitQuestion(confirmText ?? "");
  const destructive = variant === "danger";
  const confirmWord = confirmLabel ?? (/^[✕×x]$/i.test(label.trim()) ? "Delete" : label.replace(/…$/, ""));

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (askReason && !reason.trim()) { setReasonErr("A reason is required."); return; }   // validate inline, not after a round trip
    if (await run(askReason ? { reason: reason.trim() } : {})) { setSheet(false); setReason(""); }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button ref={trigger} onClick={() => (needsSheet ? (setErr(null), setReasonErr(null), setSheet(true)) : run())} disabled={busy && !sheet} className={`btn-${variant} btn-sm`}>{busy && !sheet ? "…" : label}</button>
      {err && !sheet && <span className="max-w-md text-xs text-red-600 dark:text-red-400" role="alert">{err}</span>}
      {ok && <span className="max-w-md text-xs text-(--forest)" role="status">{ok}</span>}

      <Sheet open={sheet} onClose={() => setSheet(false)} title={q.title} description={q.message} originRef={trigger} busy={busy}>
        <form onSubmit={submit} className="space-y-4">
          {askReason && (
            <div>
              <label htmlFor="sheet-reason" className="label">Reason</label>
              <input id="sheet-reason" data-autofocus className="input" value={reason} onChange={(e) => { setReason(e.target.value); setReasonErr(null); }}
                aria-invalid={reasonErr ? true : undefined} aria-describedby={reasonErr ? "sheet-reason-err" : undefined} autoComplete="off" />
              {reasonErr && <p id="sheet-reason-err" role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">{reasonErr}</p>}
            </div>
          )}
          {err && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{err}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {/* The safe choice holds focus for destructive actions, so a stray Enter cancels rather than deletes. */}
            <button type="button" className="btn-ghost" aria-disabled={busy || undefined} onClick={() => { if (!busy) setSheet(false); }} {...(destructive ? { "data-autofocus": true } : {})}>Cancel</button>
            <button type="submit" aria-disabled={busy || undefined} className={destructive ? "btn-danger" : "btn-primary"} {...(!destructive && !askReason ? { "data-autofocus": true } : {})}>{busy ? "Working…" : confirmWord}</button>
          </div>
        </form>
      </Sheet>
    </span>
  );
}

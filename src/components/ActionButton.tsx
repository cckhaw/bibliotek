"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** One-click POST/DELETE with optional confirm() or a required reason prompt (e.g. fine waivers). */
export function ActionButton({
  url, method = "POST", body, label, variant = "ghost", confirmText, askReason,
}: {
  url: string; method?: "POST" | "DELETE" | "PUT" | "PATCH"; body?: Record<string, unknown>; label: string;
  variant?: "primary" | "ghost" | "danger"; confirmText?: string; askReason?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    if (confirmText && !window.confirm(confirmText)) return;
    let extra: Record<string, unknown> = {};
    if (askReason) {
      const reason = window.prompt(askReason);
      if (!reason) return;
      extra = { reason };
    }
    setBusy(true); setErr(null);
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, ...extra }) });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setErr(d?.error?.message ?? "Failed");
    } else router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button onClick={go} disabled={busy} className={`btn-${variant} btn-sm`}>{busy ? "…" : label}</button>
      {err && <span className="text-xs text-red-600" role="alert">{err}</span>}
    </span>
  );
}

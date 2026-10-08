"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "./PasswordInput";

export interface Field {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "number" | "select" | "textarea" | "checkbox" | "datetime-local" | "hidden";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  step?: string;
  min?: number;
  hint?: string;
  half?: boolean;
  autoComplete?: string;
  disabled?: boolean;
}

/** Submit JSON to an API route, surface the standard { error: { message } } contract, then refresh server data. */
export function ApiForm({
  action, method = "POST", fields, submit, successMessage, reset = true, className = "",
}: {
  action: string; method?: "POST" | "PUT" | "PATCH"; fields: Field[]; submit: string;
  successMessage?: string; reset?: boolean; className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = fd.get(f.name);
      if (f.type === "checkbox") body[f.name] = raw === "on";
      else if (f.type === "datetime-local") body[f.name] = raw ? new Date(String(raw)).toISOString() : undefined; // browser-local -> UTC instant
      else if (f.type === "number") body[f.name] = raw === "" || raw == null ? undefined : Number(raw);
      else body[f.name] = raw === "" ? undefined : raw;
    }
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(action, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = data?.error?.details;
        const extra = Array.isArray(d) ? " " + d.map((x: { path: string; message: string }) => `${x.path}: ${x.message}`).join("; ") : "";
        setMsg({ ok: false, text: (data?.error?.message ?? "Request failed") + extra });
      } else {
        setMsg({ ok: true, text: data.message ?? successMessage ?? "Saved." });
        if (reset) form.reset();
        if (data.redirect) router.push(data.redirect);
        else router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Network error. Please try again." });
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={onSubmit} className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      {fields.map((f) => f.type === "hidden" ? (
        <input key={f.name} type="hidden" name={f.name} defaultValue={String(f.defaultValue ?? "")} />
      ) : (
        <div key={f.name} className={f.type === "textarea" || !f.half ? (f.half ? "" : "sm:col-span-2") : ""}>
          {f.type === "checkbox" ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={f.name} defaultChecked={!!f.defaultValue} className="size-4 rounded border-slate-300" /> {f.label}
            </label>
          ) : (
            <>
              <label htmlFor={f.name} className="label">{f.label}{f.required && <span className="text-red-600"> *</span>}</label>
              {f.type === "select" ? (
                <select id={f.name} name={f.name} className="input" required={f.required} defaultValue={String(f.defaultValue ?? "")}>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea id={f.name} name={f.name} rows={3} className="input" required={f.required} placeholder={f.placeholder} defaultValue={String(f.defaultValue ?? "")} />
              ) : f.type === "password" ? (
                <PasswordInput id={f.name} name={f.name} required={f.required} placeholder={f.placeholder} autoComplete={f.autoComplete ?? "new-password"} />
              ) : (
                <input id={f.name} name={f.name} type={f.type ?? "text"} className="input" required={f.required} placeholder={f.placeholder}
                  defaultValue={f.defaultValue === undefined ? undefined : String(f.defaultValue)} step={f.step} min={f.min} disabled={f.disabled}
                  autoComplete={f.autoComplete ?? (f.type === "email" ? "email" : "off")} />
              )}
              {f.hint && <p className="muted mt-1">{f.hint}</p>}
            </>
          )}
        </div>
      ))}
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <button className="btn-primary w-full sm:w-auto" disabled={busy}>{busy ? "Working…" : submit}</button>
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}

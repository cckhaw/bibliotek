"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PasswordInput } from "./PasswordInput";

const RESEND_SECONDS = 60;

/** Two steps on one screen: (1) request a code by email, (2) enter the code + choose a new password. */
export function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const d = data?.error?.details;
      throw new Error((data?.error?.message ?? "Something went wrong") + (Array.isArray(d) ? " " + d.map((x: { message: string }) => x.message).join("; ") : ""));
    }
    return data as { message?: string };
  }

  async function sendCode(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setBusy(true); setError(null);
    try {
      const d = await post("/api/auth/forgot-password", { email });
      setNote(d.message ?? null); setStep("code"); setCooldown(RESEND_SECONDS);
    } catch (err) { setError((err as Error).message); }
    setBusy(false);
  }

  async function reset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    if (password !== String(fd.get("confirm"))) { setError("The two passwords don't match."); return; }
    setBusy(true); setError(null);
    try {
      await post("/api/auth/reset-password", { email, code: String(fd.get("code")).trim(), password });
      router.push("/login?reset=1");
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <div>
      <h1 className="h1 mb-1">Reset your password</h1>
      {step === "email" ? (
        <>
          <p className="muted mb-4">Enter your account email and we&apos;ll send a 6-digit verification code.</p>
          <form key="step-email" onSubmit={sendCode} className="grid gap-3">
            <div><label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" className="input" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send code"}</button>
          </form>
        </>
      ) : (
        <>
          <p role="status" className="muted mb-4">{note} Sent to <b className="break-all">{email}</b>.</p>
          <form key="step-code" onSubmit={reset} className="grid gap-3">
            <div><label htmlFor="code" className="label">Verification code</label>
              <input id="code" name="code" className="input text-center text-2xl tracking-[0.5em]" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code" placeholder="••••••" /></div>
            <div><label htmlFor="password" className="label">New password</label><PasswordInput id="password" name="password" required autoComplete="new-password" minLength={10} />
              <p className="muted mt-1">At least 10 characters.</p></div>
            <div><label htmlFor="confirm" className="label">Confirm new password</label><PasswordInput id="confirm" name="confirm" required autoComplete="new-password" minLength={10} /></div>
            <button className="btn-primary" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
          </form>
          <div className="mt-3 flex items-center justify-between text-sm">
            <button type="button" className="text-brand-link underline disabled:text-slate-400 disabled:no-underline" disabled={busy || cooldown > 0} onClick={() => sendCode()}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
            <button type="button" className="text-slate-500 underline dark:text-slate-400" onClick={() => { setStep("email"); setError(null); }}>Use a different email</button>
          </div>
        </>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Shown instead of Next's bare "Application error" when a page fails on the server. Server errors are hidden from the
 * browser in production, so this asks the public, secret-free /api/health which part of the deployment is unhealthy and
 * shows the short codes: something a user can read to an administrator, who can look them up in the README.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [problems, setProblems] = useState<string[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { checks?: Record<string, string> }) => {
        if (!live) return;
        const bad = Object.entries(d.checks ?? {}).filter(([, v]) => v !== "ok" && v !== "skipped").map(([k, v]) => `${k}: ${v}`);
        setProblems(bad);
      })
      .catch(() => live && setProblems(null));
    return () => { live = false; };
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="muted">We couldn&apos;t load this page. It may be a temporary problem; please try again. If it keeps happening, tell your administrator.</p>
      <div className="flex flex-col justify-center gap-2 sm:flex-row">
        <button className="btn-primary" onClick={() => reset()}>Try again</button>
        <Link href="/login" className="btn-ghost">Go to sign in</Link>
      </div>
      {problems && problems.length > 0 && (
        <p className="muted rounded-lg bg-slate-100 p-3 text-left text-xs dark:bg-slate-800" role="note">
          <b>System check</b> (give this to your administrator):<br />{problems.map((p) => <span key={p} className="block font-mono">{p}</span>)}
        </p>
      )}
      {error.digest && <p className="muted text-xs">Reference: {error.digest}</p>}
    </main>
  );
}

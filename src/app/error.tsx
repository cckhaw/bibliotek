"use client";
import Link from "next/link";

/** Shown instead of Next's bare "Application error" when a page fails on the server. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="muted">We couldn&apos;t load this page. It may be a temporary problem; please try again. If it keeps happening, tell your administrator.</p>
      <div className="flex flex-col justify-center gap-2 sm:flex-row">
        <button className="btn-primary" onClick={() => reset()}>Try again</button>
        <Link href="/login" className="btn-ghost">Go to sign in</Link>
      </div>
      {error.digest && <p className="muted text-xs">Reference: {error.digest}</p>}
    </main>
  );
}

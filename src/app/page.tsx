import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { HOME } from "@/lib/auth/rbac";

export default async function Landing() {
  const user = await getCurrentUser();
  if (user) redirect(HOME[user.role]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bibliotek</h1>
        <p className="muted mt-2 text-base">Library management for schools and universities — multiple campuses, one catalogue, books that can be returned anywhere.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/login" className="btn-primary">Sign in</Link>
        <Link href="/register" className="btn-ghost">Student registration</Link>
      </div>
    </main>
  );
}

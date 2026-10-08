import Link from "next/link";
import { ApiForm } from "@/components/ApiForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  return (
    <>
      <h1 className="h1 mb-4">Sign in</h1>
      {reset && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">Password updated. Sign in with your new password.</p>}
      <ApiForm action="/api/auth/login" submit="Sign in" reset={false} className="!grid-cols-1" fields={[
        { name: "email", label: "Email", type: "email", required: true },
        { name: "password", label: "Password", type: "password", required: true, autoComplete: "current-password" },
      ]} />
      <p className="mt-3 text-sm"><Link className="text-brand-600 underline" href="/forgot-password">Forgot password?</Link></p>
      <p className="muted mt-3">New student? <Link className="text-brand-600 underline" href="/register">Register here</Link></p>
    </>
  );
}

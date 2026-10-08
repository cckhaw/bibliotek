import Link from "next/link";
import { ApiForm } from "@/components/ApiForm";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="h1 mb-4">Sign in</h1>
      <ApiForm action="/api/auth/login" submit="Sign in" reset={false} className="!grid-cols-1" fields={[
        { name: "email", label: "Email", type: "email", required: true },
        { name: "password", label: "Password", type: "password", required: true },
      ]} />
      <p className="muted mt-4">New student? <Link className="text-brand-600 underline" href="/register">Register here</Link></p>
    </>
  );
}

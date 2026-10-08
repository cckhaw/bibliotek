import Link from "next/link";
import { Mark } from "@/components/marketing";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2.5 font-display text-2xl font-semibold tracking-tight" aria-label="Bibliotek home"><Mark />Bibliotek</Link>
      <div className="card">{children}</div>
    </main>
  );
}

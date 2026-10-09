import Link from "next/link";
import { Mark } from "@/components/marketing";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-8 flex items-center justify-center gap-2.5 text-2xl font-semibold tracking-[-0.02em]" aria-label="Bibliotek home"><Mark />Bibliotek</Link>
      <div className="card sm:p-8">{children}</div>
    </main>
  );
}

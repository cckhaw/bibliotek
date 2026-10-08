import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-6 text-xl font-bold tracking-tight">Bibliotek</Link>
      <div className="card">{children}</div>
    </main>
  );
}

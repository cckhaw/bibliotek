import Link from "next/link";
import { ForgotPassword } from "@/components/ForgotPassword";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <ForgotPassword />
      <p className="muted mt-5">Remembered it? <Link className="text-brand-600 underline" href="/login">Back to sign in</Link></p>
    </>
  );
}

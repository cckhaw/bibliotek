import Link from "next/link";
import { ApiForm } from "@/components/ApiForm";

export const metadata = { title: "Student registration" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="h1 mb-1">Student registration</h1>
      <p className="muted mb-4">Use your school email if you have one — it may activate your account instantly. Otherwise a librarian will verify your student ID.</p>
      <ApiForm action="/api/auth/register" submit="Register" fields={[
        { name: "tenantCode", label: "School code", required: true, placeholder: "e.g. monash-my", hint: "Ask your library for your school's code." },
        { name: "fullName", label: "Full name", required: true },
        { name: "studentId", label: "Student ID", required: true, half: true },
        { name: "department", label: "Grade / department", half: true },
        { name: "email", label: "Email", type: "email", required: true },
        { name: "phone", label: "Phone (optional)", half: true },
        { name: "password", label: "Password", type: "password", required: true, hint: "At least 10 characters." },
      ]} />
      <p className="muted mt-4">Already registered? <Link className="text-brand-600 underline" href="/login">Sign in</Link></p>
    </>
  );
}

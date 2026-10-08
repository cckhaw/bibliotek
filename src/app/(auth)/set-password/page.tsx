import { ApiForm } from "@/components/ApiForm";

export const metadata = { title: "Set password" };

export default async function SetPassword({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) return <p>This link is missing its token. Open the link from your invitation email.</p>;
  return (
    <>
      <h1 className="h1 mb-4">Choose a password</h1>
      <ApiForm action="/api/auth/set-password" submit="Save password" className="!grid-cols-1" fields={[
        { name: "token", label: "", type: "hidden", defaultValue: token },
        { name: "password", label: "New password", type: "password", required: true, hint: "At least 10 characters." },
      ]} />
    </>
  );
}

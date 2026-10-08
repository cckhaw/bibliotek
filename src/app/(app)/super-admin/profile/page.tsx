import { requirePage } from "@/lib/auth/session";
import { ApiForm } from "@/components/ApiForm";
import { isEnvManagedEmail } from "@/lib/services/platform-users";

export const metadata = { title: "My profile" };

export default async function OperatorProfile() {
  const user = await requirePage("tenants:manage");
  const managed = isEnvManagedEmail(user.email);
  return (
    <>
      <h1 className="h1">My profile</h1>
      <section className="card max-w-xl">
        {managed ? (
          <>
            <p className="muted mb-4">This account is managed by the <code>SUPERADMIN_EMAIL</code> / <code>SUPERADMIN_PASSWORD</code> environment variables. You can change your display name here; to change the email or password, update those variables and redeploy.</p>
            <ApiForm action="/api/super-admin/profile" method="PATCH" reset={false} submit="Save" className="!grid-cols-1" fields={[
              { name: "fullName", label: "Name", required: true, defaultValue: user.fullName },
              { name: "email", label: "Email (managed by environment)", type: "email", defaultValue: user.email, disabled: true },
            ]} />
          </>
        ) : (
          <ApiForm action="/api/super-admin/profile" method="PATCH" reset={false} submit="Save changes" className="!grid-cols-1" fields={[
            { name: "fullName", label: "Name", required: true, defaultValue: user.fullName },
            { name: "email", label: "Email", type: "email", required: true, defaultValue: user.email },
            { name: "currentPassword", label: "Current password", type: "password", autoComplete: "current-password", hint: "Only needed when you change your email." },
          ]} />
        )}
      </section>
    </>
  );
}

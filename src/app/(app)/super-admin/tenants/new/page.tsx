import { requirePage } from "@/lib/auth/session";
import { ApiForm } from "@/components/ApiForm";
import { TIER_PRESETS } from "@/lib/services/licensing";

export const metadata = { title: "Provision tenant" };

export default async function NewTenant() {
  await requirePage("tenants:manage");
  return (
    <>
      <h1 className="h1">Provision a tenant</h1>
      <section className="card">
        <p className="muted mb-4">Creates the school, a &quot;Main Library&quot; branch, a default borrowing policy and the first school admin, who receives an email invitation.</p>
        <ApiForm action="/api/super-admin/tenants" submit="Create tenant" fields={[
          { name: "name", label: "School / university name", required: true, half: true },
          { name: "code", label: "Tenant code", required: true, half: true, placeholder: "monash-my", hint: "Lowercase; used by students when registering." },
          { name: "tier", label: "Plan", type: "select", defaultValue: "STANDARD", half: true,
            options: Object.entries(TIER_PRESETS).map(([k, v]) => ({ value: k, label: `${k} — ${v.maxStudents.toLocaleString()} students / ${v.maxBooks.toLocaleString()} books` })) },
          { name: "adminName", label: "Admin name", required: true, half: true },
          { name: "adminEmail", label: "Admin email", type: "email", required: true, half: true },
        ]} />
      </section>
    </>
  );
}

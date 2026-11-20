import { requireUser } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/roles";
import { PageHeader } from "@/components/ui";
import { isAutoParentEmail } from "@/lib/parents";
import { PasswordForm } from "./form";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="My account" subtitle={`${user.name} · ${user.isOwner ? "Principal" : ROLE_LABEL[user.role]} · ${isAutoParentEmail(user.email) ? "signs in with mobile number" : user.email}`} />
      <section className="card max-w-md">
        <h2 className="mb-4 font-semibold">Change password</h2>
        <PasswordForm />
      </section>
    </>
  );
}

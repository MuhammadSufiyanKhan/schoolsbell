"use client";
import { useActionState } from "react";
import { GuardianFields } from "@/components/profile-fields";
import { ParentLoginNotice } from "@/components/parent-login-notice";
import { updateGuardian } from "./actions";

type Initial = { id: number; guardianName: string; guardianPhone: string; guardianCnic: string };

export function GuardianEditForm({ initial }: { initial: Initial }) {
  const [state, action, pending] = useActionState(updateGuardian, undefined);
  const v = state?.error ? state.values : (initial as unknown as Record<string, string>);
  return (
    <>
    <form key={state?.at ?? 0} action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={initial.id} />
      <GuardianFields v={v} idp="ge" />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save guardian details"}</button>
        {state?.ok && <span role="status" className="text-sm text-good">Saved.</span>}
        {state?.error && <span role="alert" className="text-sm text-bad">{state.error}</span>}
      </div>
    </form>
    <ParentLoginNotice login={state?.parent} />
    </>
  );
}

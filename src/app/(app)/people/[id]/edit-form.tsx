"use client";
import { useActionState } from "react";
import { StaffFields } from "@/components/profile-fields";
import { updateStaff } from "./actions";

type Initial = { id: number; name: string; phone: string; cnic: string; specializations: string };

export function StaffEditForm({ initial, suggestions }: { initial: Initial; suggestions: string[] }) {
  const [state, action, pending] = useActionState(updateStaff, undefined);
  // After an error show what they typed; after a save show the freshly stored values.
  const v = state?.error ? state.values : (initial as unknown as Record<string, string>);
  return (
    <form key={state?.at ?? 0} action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={initial.id} />
      <div className="sm:col-span-2">
        <label className="label" htmlFor="e-name">Full name</label>
        <input id="e-name" name="name" required maxLength={120} defaultValue={v?.name} className="input" />
      </div>
      <StaffFields v={v} suggestions={suggestions} idp="e" />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save details"}</button>
        {state?.ok && <span role="status" className="text-sm text-good">Saved.</span>}
        {state?.error && <span role="alert" className="text-sm text-bad">{state.error}</span>}
      </div>
    </form>
  );
}

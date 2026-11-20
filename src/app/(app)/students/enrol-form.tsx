"use client";
import { useActionState } from "react";
import { GuardianFields } from "@/components/profile-fields";
import { ParentLoginNotice } from "@/components/parent-login-notice";
import { addStudent } from "./actions";

export function EnrolForm({ classes }: { classes: { id: number; label: string }[] }) {
  const [state, action, pending] = useActionState(addStudent, undefined);
  const v = state?.error ? state.values : undefined;
  return (
    <section className="card mt-8 max-w-xl">
      <h2 className="mb-1 text-sm font-semibold">Enrol a new student</h2>
      <p className="mb-4 text-xs text-muted">To also give the student a login, use People instead.</p>
      <form key={state?.at ?? 0} action={action} className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" name="name" required defaultValue={v?.name} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="rollNo">Roll no</label>
          <input id="rollNo" name="rollNo" required defaultValue={v?.rollNo} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="classId">Class</label>
          <select id="classId" name="classId" required defaultValue={v?.classId} className="input">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="dob">Date of birth</label>
          <input id="dob" name="dob" type="date" defaultValue={v?.dob} className="input" />
        </div>
        <div className="hidden sm:block" />
        <GuardianFields v={v} idp="enrol" />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button className="btn" disabled={pending}>{pending ? "Adding…" : "Add student"}</button>
          {state?.ok && <span role="status" className="text-sm text-good">{state.ok}</span>}
          {state?.error && <span role="alert" className="text-sm text-bad">{state.error}</span>}
        </div>
      </form>
      <ParentLoginNotice login={state?.parent} />
    </section>
  );
}

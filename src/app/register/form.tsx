"use client";
import { useActionState } from "react";
import { registerSchool } from "./actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerSchool, undefined);
  return (
    <form key={state?.at ?? 0} action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="schoolName">School or institute name</label>
        <input id="schoolName" name="schoolName" defaultValue={state?.values?.schoolName} required maxLength={120} className="input" autoComplete="organization" />
      </div>
      <div>
        <label className="label" htmlFor="name">Your name (principal)</label>
        <input id="name" name="name" defaultValue={state?.values?.name} required maxLength={120} className="input" autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" defaultValue={state?.values?.email} required className="input" autoComplete="username" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={8} className="input" autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input id="confirm" name="confirm" type="password" required minLength={8} className="input" autoComplete="new-password" />
        </div>
      </div>
      {/* Honeypot — hidden from people and assistive tech */}
      <div aria-hidden className="absolute -left-[9999px]">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "Creating your school…" : "Create school"}</button>
    </form>
  );
}

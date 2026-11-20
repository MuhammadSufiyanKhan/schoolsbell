"use client";
import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form key={state?.at ?? 0} action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email or mobile number</label>
        <input id="email" name="email" type="text" inputMode="email" autoComplete="username" defaultValue={state?.email ?? "admin@school.test"} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" defaultValue={state ? undefined : "password123"} required className="input" />
      </div>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

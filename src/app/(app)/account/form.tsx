"use client";
import { useActionState } from "react";
import { changePassword } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label" htmlFor="current">Current password</label>
        <input id="current" name="current" type="password" required autoComplete="current-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="next">New password</label>
        <input id="next" name="next" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-good">Password updated.</p>}
      <button className="btn" disabled={pending}>{pending ? "Saving…" : "Update password"}</button>
    </form>
  );
}

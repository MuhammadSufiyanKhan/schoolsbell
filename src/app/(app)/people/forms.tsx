"use client";
import { useActionState, useState } from "react";
import { createUser, resetPassword, type CredState } from "./actions";

function Credentials({ c }: { c: NonNullable<NonNullable<CredState>["created"]> }) {
  const [copied, setCopied] = useState(false);
  const text = `Email: ${c.email}\nPassword: ${c.password}`;
  return (
    <div role="status" className="mt-4 rounded-lg border border-good/40 bg-good-soft p-4 text-sm">
      <p className="font-medium text-good">Account ready for {c.name}</p>
      <p className="mt-1 text-xs text-muted">Copy these now: for security the password is shown only once. Ask them to change it after signing in.</p>
      <pre className="mt-2 select-all rounded bg-surface p-2 font-mono text-xs">{text}</pre>
      <button
        type="button"
        className="mt-2 text-xs text-brand hover:underline"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

type Opt = { id: number; label: string };

/**
 * Fields live in their own component so the form can be remounted (via `key`) after every submit:
 * React 19 resets form fields after an action, which would otherwise desync the role dropdown
 * from the role-dependent fields, and wipe what the user typed when there's an error.
 */
function Fields({ classes, students, canCreateAdmin, v }: { classes: Opt[]; students: Opt[]; canCreateAdmin: boolean; v?: Record<string, string> }) {
  const [role, setRole] = useState(v?.role ?? "teacher");
  return (
    <>
        <div>
          <label className="label" htmlFor="u-name">Full name</label>
          <input id="u-name" name="name" required defaultValue={v?.name} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="u-email">Email (their login)</label>
          <input id="u-email" name="email" type="email" required defaultValue={v?.email} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="u-role">Role</label>
          <select id="u-role" name="role" value={role} onChange={(e) => setRole(e.target.value)} className="input">
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
            <option value="parent">Parent</option>
            {canCreateAdmin && <option value="admin">Administrator</option>}
          </select>
        </div>
        {role === "student" && (
          <>
            <div>
              <label className="label" htmlFor="u-class">Class</label>
              <select id="u-class" name="classId" required defaultValue={v?.classId} className="input">
                {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="u-roll">Roll number</label>
              <input id="u-roll" name="rollNo" required defaultValue={v?.rollNo} className="input" />
            </div>
          </>
        )}
        {role === "parent" && (
          <div className="sm:col-span-2">
            <label className="label" htmlFor="u-student">Link to child (optional)</label>
            <select id="u-student" name="studentId" className="input" defaultValue={v?.studentId ?? ""}>
              <option value="">— none —</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        )}
    </>
  );
}

export function CreateUserForm({ classes, students, canCreateAdmin }: { classes: Opt[]; students: Opt[]; canCreateAdmin: boolean }) {
  const [state, action, pending] = useActionState(createUser, undefined);
  return (
    <section className="card max-w-2xl">
      <h2 className="mb-1 font-semibold">Add a person</h2>
      <p className="mb-4 text-sm text-muted">A one-time password is generated for them.</p>
      <form key={state?.at ?? 0} action={action} className="grid gap-3 sm:grid-cols-2">
        <Fields classes={classes} students={students} canCreateAdmin={canCreateAdmin} v={state?.error ? state.values : undefined} />
        <div className="sm:col-span-2">
          <button className="btn" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>
        </div>
      </form>
      {state?.error && <p role="alert" className="mt-3 text-sm text-bad">{state.error}</p>}
      {state?.created && <Credentials c={state.created} />}
    </section>
  );
}

export function ResetPasswordButton({ id }: { id: number }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="text-right">
      <input type="hidden" name="id" value={id} />
      <button className="btn-ghost !py-1 text-xs" disabled={pending}>{pending ? "…" : "Reset password"}</button>
      {state?.error && <p role="alert" className="mt-1 text-xs text-bad">{state.error}</p>}
      {state?.created && (
        <p role="status" className="mt-1 break-all rounded bg-good-soft px-2 py-1 text-left font-mono text-xs text-good">
          New password: {state.created.password}
        </p>
      )}
    </form>
  );
}

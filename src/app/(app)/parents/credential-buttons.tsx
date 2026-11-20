"use client";
import { useActionState, useState } from "react";
import { resetParentPassword, revealParentPassword, type RevealState } from "./actions";

function Result({ state }: { state: RevealState }) {
  const [copied, setCopied] = useState(false);
  if (state?.error) return <p role="alert" className="mt-2 text-xs text-bad">{state.error}</p>;
  if (!state?.password) return null;
  const text = `Login (mobile): ${state.login}\nPassword: ${state.password}`;
  return (
    <div role="status" className="mt-2 rounded-lg border border-border bg-background p-2 text-left">
      <pre className="select-all whitespace-pre-wrap break-all font-mono text-xs">{text}</pre>
      <button
        type="button"
        className="mt-1 text-xs text-brand hover:underline"
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

/** Fetches the password only when clicked, so it is never part of the page's HTML. */
export function RevealButton({ id }: { id: number }) {
  const [state, action, pending] = useActionState(revealParentPassword, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="btn-ghost !py-1 text-xs" disabled={pending}>{pending ? "…" : "Show login & password"}</button>
      <Result state={state} />
    </form>
  );
}

export function ResetButton({ id }: { id: number }) {
  const [state, action, pending] = useActionState(resetParentPassword, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="btn-ghost !py-1 text-xs" disabled={pending}>{pending ? "…" : "Reset password"}</button>
      <Result state={state} />
    </form>
  );
}

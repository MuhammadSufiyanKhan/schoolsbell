"use client";
import { useActionState, useState } from "react";
import type { AiState } from "./actions";

type Action = (prev: AiState | undefined, form: FormData) => Promise<AiState>;

export function AiTool({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action: Action;
  children: React.ReactNode;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  const [copied, setCopied] = useState(false);

  return (
    <section className="card">
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-muted">{description}</p>
      <form action={run} className="grid gap-3 sm:grid-cols-2">
        {children}
        <div className="sm:col-span-2">
          <button className="btn" disabled={pending}>{pending ? "Generating…" : "Generate draft"}</button>
        </div>
      </form>
      <div aria-live="polite">
        {state?.error && <p role="alert" className="mt-4 text-sm text-bad">{state.error}</p>}
        {state?.text && (
          <div className="mt-4 rounded-lg border border-border bg-background p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">AI draft — review before use</span>
              <button
                type="button"
                className="text-xs text-brand hover:underline"
                onClick={async () => {
                  await navigator.clipboard.writeText(state.text!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{state.text}</pre>
          </div>
        )}
      </div>
    </section>
  );
}

export const Field = ({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label className="label" htmlFor={name}>{label}</label>
    <input id={name} name={name} required className="input" {...rest} />
  </div>
);

export const Select = ({ label, name, options }: { label: string; name: string; options: { value: string | number; label: string }[] }) => (
  <div>
    <label className="label" htmlFor={name}>{label}</label>
    <select id={name} name={name} className="input">
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

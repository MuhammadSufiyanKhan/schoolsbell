"use client";
import { useState } from "react";
import type { ParentLogin } from "@/lib/parent-types";

/** Tells the administrator what happened to the parent login after guardian details were saved. */
export function ParentLoginNotice({ login }: { login?: ParentLogin }) {
  const [copied, setCopied] = useState(false);
  if (!login) return null;

  if (login.kind === "created") {
    const text = `Login (mobile): ${login.phone}\nPassword: ${login.password}`;
    return (
      <div role="status" className="mt-4 rounded-lg border border-good/40 bg-good-soft p-4 text-sm">
        <p className="font-medium text-good">Parent login created for {login.name}</p>
        <p className="mt-1 text-xs text-muted">
          The parent signs in with their mobile number. Copy this now: you can also find it on the Parents tab until they change their password.
        </p>
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
  if (login.kind === "linked") {
    if (login.alreadyLinked) return null;
    return (
      <p role="status" className="mt-4 rounded-lg bg-brand-soft px-4 py-3 text-sm text-brand">
        Linked to the existing parent account for {login.name} ({login.phone}). Their login is unchanged and now covers this child too.
      </p>
    );
  }
  if (login.kind === "updated") {
    return (
      <p role="status" className="mt-4 rounded-lg bg-brand-soft px-4 py-3 text-sm text-brand">
        Parent login updated: {login.name} now signs in with {login.phone}. Their password is unchanged (see the Parents tab).
      </p>
    );
  }
  return (
    <p role="status" className="mt-4 rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">
      No parent login was created. Add the guardian&apos;s mobile number and one will be created automatically.
    </p>
  );
}

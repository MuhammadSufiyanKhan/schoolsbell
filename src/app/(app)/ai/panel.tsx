"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Copy, Check, Square, Sparkles } from "lucide-react";
import { Markdown } from "@/components/markdown";

type Phase = "idle" | "waiting" | "writing" | "done" | "stopped" | "error";

/** Record Separator: the server appends it, then a JSON error, if the model fails AFTER text has started. */
const RS = "\u001e";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function AiTool({ tool, title, description, children }: { tool: string; title: string; description: string; children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);

  // Cancel any request still running if the teacher leaves the page.
  useEffect(() => () => abort.current?.abort(), []);

  // A visible timer while the AI works, so a slow answer never looks like a frozen page.
  const busy = phase === "waiting" || phase === "writing";
  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [busy]);

  async function run(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setPhase("waiting");
    setText("");
    setError(null);
    setElapsed(0);
    setCopied(false);
    let got = "";
    try {
      const res = await fetch(`/api/ai/${tool}`, { method: "POST", body: new FormData(e.currentTarget), signal: ctrl.signal });
      // A redirect to the login page (expired session) or any non-text body is NOT an AI answer.
      const isStream = res.ok && !res.redirected && (res.headers.get("content-type") ?? "").startsWith("text/plain");
      if (res.redirected || res.status === 401) {
        setError("Your session has expired. Please sign in again, then try once more.");
        setPhase("error");
        return;
      }
      if (!isStream || !res.body) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Something went wrong. Please try again.");
        setPhase("error");
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        got += dec.decode(value, { stream: true });
        const cut = got.indexOf(RS);
        if (cut >= 0) {
          // Failure after the answer had started: keep what we have and say why it stopped.
          setText(got.slice(0, cut));
          try {
            setError(JSON.parse(got.slice(cut + 1)).error ?? "The AI stopped unexpectedly.");
          } catch {
            setError("The AI stopped unexpectedly.");
          }
          setPhase("error");
          return;
        }
        setText(got);
        setPhase("writing");
      }
      setText(got);
      setPhase("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setText(got);
        setPhase("stopped");
      } else {
        setError("Couldn't reach the server. Check your connection and try again.");
        setPhase("error");
      }
    }
  }

  return (
    <section className="card">
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-muted">{description}</p>

      <form onSubmit={run} className="grid gap-3 sm:grid-cols-2">
        {children}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button className="btn" disabled={busy}>
            <Sparkles className="size-4" aria-hidden /> {busy ? "Working…" : text ? "Generate again" : "Generate draft"}
          </button>
          {busy && (
            <button type="button" className="btn-ghost" onClick={() => abort.current?.abort()}>
              <Square className="size-3.5" aria-hidden /> Stop
            </button>
          )}
        </div>
      </form>

      {/* Short, polite status updates for screen readers (not the streaming text itself). */}
      <p className="sr-only" role="status" aria-live="polite">
        {phase === "waiting" ? "The AI is thinking." : phase === "writing" ? "The AI is writing." : phase === "done" ? "The draft is ready." : ""}
      </p>

      {phase === "waiting" && (
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm" data-testid="ai-waiting">
          <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-brand" /></span>
          <span>Thinking… <span className="tabular-nums text-muted">{clock(elapsed)}</span></span>
          <span className="text-xs text-muted">Your draft will appear here as soon as the AI starts writing.</span>
        </div>
      )}

      {error && <p role="alert" className="mt-5 rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad">{error}</p>}

      {text && (
        <article className="mt-5 rounded-xl border border-border bg-surface shadow-sm" aria-busy={busy} data-testid="ai-result">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-2.5">
            <span className="text-xs font-medium text-muted">
              Draft: review before use
              {phase === "writing" && <span className="ml-2 text-brand">Writing… <span className="tabular-nums">{clock(elapsed)}</span></span>}
              {phase === "stopped" && <span className="ml-2 text-warn">Stopped</span>}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline"
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? "Copied" : "Copy"}
            </button>
          </header>
          <div className="mx-auto max-w-3xl px-6 py-5" data-testid="ai-body">
            <Markdown>{text}</Markdown>
          </div>
        </article>
      )}
    </section>
  );
}

// Unique ids per field: the four tools share names like "grade" and "topic", and duplicate ids break label association.
export function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} name={name} required className="input" {...rest} />
    </div>
  );
}

export function Select({ label, name, options }: { label: string; name: string; options: { value: string | number; label: string }[] }) {
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} name={name} className="input">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

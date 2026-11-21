"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Download, FileText, Sparkles, Square, Upload, X } from "lucide-react";
import type { Exam, PaperMeta } from "@/lib/exam-types";

const MAX_BYTES = 8 * 1024 * 1024;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const LETTERS = "ABCDEF";

function Num({ label, name, defaultValue, max }: { label: string; name: string; defaultValue: number; max: number }) {
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} name={name} type="number" min={0} max={max} defaultValue={defaultValue} className="input" inputMode="numeric" />
    </div>
  );
}

function Text({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} name={name} className="input" {...rest} />
    </div>
  );
}

function examText(exam: Exam, withAnswers: boolean) {
  const out = [exam.title, "", exam.instructions, ""];
  exam.questions.forEach((q, i) => {
    out.push(`${i + 1}. ${q.prompt} [${q.marks}]`);
    q.options?.forEach((o, j) => out.push(`   ${LETTERS[j]}. ${o}${withAnswers && j === q.correctIndex ? "  ✓" : ""}`));
    if (withAnswers && q.answer) out.push(`   Marking guide: ${q.answer}`);
    out.push("");
  });
  return out.join("\n").trim();
}

export function ExamGenerator() {
  const fileId = useId();
  const promptId = useId();
  const pagesId = useId();
  const diffId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [meta, setMeta] = useState<PaperMeta>({ subject: "", grade: "", duration: "", date: "" });
  const [showAnswers, setShowAnswers] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<"student" | "teacher" | null>(null);
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(id);
  }, [busy]);

  const isPdf = !!file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name));

  function pick(f: File | null) {
    setFileError(null);
    if (f && f.size > MAX_BYTES) {
      setFileError("That file is larger than 8 MB. Please upload a smaller one.");
      if (fileInput.current) fileInput.current.value = "";
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function generate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    // Paper details are kept in state (they print on the PDF); everything else goes to the AI.
    setMeta({
      subject: String(data.get("subject") ?? "").trim(),
      grade: String(data.get("grade") ?? "").trim(),
      duration: String(data.get("duration") ?? "").trim(),
      date: String(data.get("date") ?? "").trim(),
    });
    if (!file) data.delete("lesson");
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setElapsed(0);
    setError(null);
    setNotice(null);
    setExam(null);
    setShowAnswers(false);
    try {
      const res = await fetch("/api/exam/generate", { method: "POST", body: data, signal: ctrl.signal });
      if (res.redirected || res.status === 401) {
        setError("Your session has expired. Please sign in again, then try once more.");
        return;
      }
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.exam) {
        setError(body?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setExam(body.exam as Exam);
      setNotice(body.notice ?? null);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function download(variant: "student" | "teacher") {
    if (!exam) return;
    setPdfBusy(variant);
    setError(null);
    try {
      const res = await fetch("/api/exam/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exam, meta, variant }) });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "The PDF couldn't be created. Please try again.");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exam.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "test"}${variant === "teacher" ? "-answer-key" : ""}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPdfBusy(null);
    }
  }

  const total = exam ? exam.questions.reduce((s, q) => s + q.marks, 0) : 0;

  return (
    <section className="card xl:col-span-2" aria-labelledby="exam-title">
      <h2 id="exam-title" className="font-semibold">Test generator</h2>
      <p className="mb-4 mt-1 text-sm text-muted">
        Upload a lesson (PDF or a photo of the page), say what kind of test you want, and download it as a print-ready PDF with a separate teacher copy that has the answers.
      </p>

      <form onSubmit={generate} className="grid gap-4 lg:grid-cols-2" data-testid="exam-form">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor={fileId}>Lesson (optional)</label>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-3">
              <Upload className="size-4 text-muted" aria-hidden />
              <input
                ref={fileInput}
                id={fileId}
                name="lesson"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp"
                className="min-w-0 flex-1 text-sm"
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
              />
              {file && (
                <button type="button" className="btn-ghost" onClick={() => { pick(null); if (fileInput.current) fileInput.current.value = ""; }}>
                  <X className="size-3.5" aria-hidden /> Remove
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">PDF, PNG, JPG or WebP, up to 8 MB. Photos up to 3 MB. A scanned PDF can&apos;t be read: upload its pages as photos instead.</p>
            {fileError && <p role="alert" className="mt-1 text-xs text-bad">{fileError}</p>}
          </div>

          {isPdf && (
            <div>
              <label className="label" htmlFor={pagesId}>Pages to use (optional)</label>
              <input id={pagesId} name="pages" className="input" placeholder="e.g. 3-5, 8" maxLength={40} />
            </div>
          )}

          <div>
            <label className="label" htmlFor={promptId}>What kind of test? {file ? "(optional)" : ""}</label>
            <textarea
              id={promptId}
              name="prompt"
              rows={4}
              maxLength={2000}
              required={!file}
              className="input"
              placeholder="e.g. Chapter 4 test for Grade 7 Science. Focus on the water cycle, include a diagram-based question, and keep the language simple."
            />
          </div>
        </div>

        <div className="space-y-4">
          <fieldset>
            <legend className="label">How many questions?</legend>
            <div className="grid grid-cols-3 gap-3">
              <Num label="Multiple choice" name="mcq" defaultValue={5} max={30} />
              <Num label="Short answer" name="short" defaultValue={3} max={20} />
              <Num label="Long answer" name="long" defaultValue={1} max={10} />
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor={diffId}>Difficulty</label>
              <select id={diffId} name="difficulty" className="input" defaultValue="medium">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <Text label="Language of the test" name="language" defaultValue="English" required maxLength={40} />
          </div>
          <fieldset>
            <legend className="label">Printed on the paper</legend>
            <div className="grid grid-cols-2 gap-3">
              <Text label="Subject" name="subject" placeholder="Science" maxLength={80} />
              <Text label="Class" name="grade" placeholder="Grade 7" maxLength={40} />
              <Text label="Time allowed" name="duration" placeholder="1 hour" maxLength={40} />
              <Text label="Date" name="date" placeholder="Optional" maxLength={40} />
            </div>
          </fieldset>
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
          <button className="btn" disabled={busy}>
            <Sparkles className="size-4" aria-hidden /> {busy ? "Working…" : exam ? "Generate again" : "Generate test"}
          </button>
          {busy && (
            <>
              <button type="button" className="btn-ghost" onClick={() => abort.current?.abort()}>
                <Square className="size-3.5" aria-hidden /> Stop
              </button>
              <span className="text-sm text-muted" data-testid="exam-waiting">
                {file ? "Reading the lesson and writing the test…" : "Writing the test…"} <span className="tabular-nums">{clock(elapsed)}</span>
              </span>
            </>
          )}
        </div>
      </form>

      <p className="sr-only" role="status" aria-live="polite">{busy ? "The AI is working." : exam ? "The test is ready." : ""}</p>
      {error && <p role="alert" className="mt-5 rounded-lg bg-bad-soft px-4 py-3 text-sm text-bad" data-testid="exam-error">{error}</p>}
      {notice && <p className="mt-5 rounded-lg bg-warn-soft px-4 py-3 text-sm text-warn">{notice}</p>}

      {exam && (
        <article className="mt-5 rounded-xl border border-border bg-surface shadow-sm" data-testid="exam-result">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
            <div>
              <h3 className="font-semibold" dir="auto">{exam.title}</h3>
              <p className="text-xs text-muted">{exam.questions.length} questions · {total} marks · Draft: review before use</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn" disabled={!!pdfBusy} onClick={() => download("student")} data-testid="exam-pdf-student">
                <Download className="size-4" aria-hidden /> {pdfBusy === "student" ? "Preparing…" : "Download PDF"}
              </button>
              <button type="button" className="btn-ghost" disabled={!!pdfBusy} onClick={() => download("teacher")} data-testid="exam-pdf-teacher">
                <FileText className="size-4" aria-hidden /> {pdfBusy === "teacher" ? "Preparing…" : "Teacher copy (answers)"}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline"
                onClick={async () => {
                  await navigator.clipboard.writeText(examText(exam, showAnswers));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? "Copied" : "Copy text"}
              </button>
            </div>
          </header>
          <div className="mx-auto max-w-3xl px-6 py-5">
            {exam.instructions && <p className="mb-4 rounded-md bg-background px-3 py-2 text-sm" dir="auto">{exam.instructions}</p>}
            <label className="mb-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} /> Show answers
            </label>
            <ol className="space-y-5">
              {exam.questions.map((q, i) => (
                <li key={i} className="text-sm">
                  <div className="flex gap-2">
                    <span className="font-semibold">{i + 1}.</span>
                    <div className="flex-1" dir="auto">{q.prompt}</div>
                    <span className="whitespace-nowrap text-xs font-medium text-muted">[{q.marks}]</span>
                  </div>
                  {q.options && (
                    <ul className="ml-6 mt-1.5 grid gap-1 sm:grid-cols-2">
                      {q.options.map((o, j) => (
                        <li key={j} className={showAnswers && j === q.correctIndex ? "font-semibold text-good" : ""} dir="auto">
                          {LETTERS[j]}. {o}{showAnswers && j === q.correctIndex ? " ✓" : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {showAnswers && q.answer && <p className="ml-6 mt-1.5 rounded-md bg-good-soft px-3 py-1.5 text-xs" dir="auto"><b>Marking guide:</b> {q.answer}</p>}
                </li>
              ))}
            </ol>
          </div>
        </article>
      )}
    </section>
  );
}

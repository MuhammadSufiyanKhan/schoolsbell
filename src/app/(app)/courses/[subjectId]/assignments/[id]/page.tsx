import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { requireCourse } from "@/lib/lms";
import { AI_NOTICES } from "@/lib/ai";
import { Badge, PageHeader } from "@/components/ui";
import { gradeSubmission, submitAssignment, suggestWithAi } from "./actions";
import { idParam } from "@/lib/ids";

export default async function AssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string; id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; submitted?: string; suggested?: string }>;
}) {
  const user = await requireUser(["admin", "teacher", "student"]);
  const { subjectId: sid, id } = await params;
  const sp = await searchParams;
  const { subject, cls, mode, student } = await requireCourse(user, idParam(sid));
  const [a] = await db.select().from(schema.assignments).where(and(eq(schema.assignments.id, idParam(id)), eq(schema.assignments.subjectId, subject.id))).limit(1);
  if (!a) notFound();
  const back = `/courses/${subject.id}`;
  const notice = sp.error ? AI_NOTICES[sp.error] : undefined;

  const header = (
    <>
      <Link href={back} className="mb-3 inline-block text-sm text-muted hover:text-foreground">← {subject.name}</Link>
      <PageHeader title={a.title} subtitle={`${cls.name}-${cls.section} · Due ${a.dueDate} · ${a.maxScore} points`} />
      <section className="card mb-6 max-w-3xl"><p className="whitespace-pre-line text-sm">{a.instructions}</p></section>
    </>
  );

  // ───────── Student view ─────────
  if (mode === "learn") {
    const [mine] = await db.select().from(schema.submissions).where(and(eq(schema.submissions.assignmentId, a.id), eq(schema.submissions.studentId, student!.id))).limit(1);
    const graded = !!mine?.gradedAt;
    return (
      <>
        {header}
        {sp.submitted && <p role="status" className="mb-4 max-w-3xl rounded-lg bg-good-soft px-4 py-2 text-sm text-good">Submitted. You can edit your answer until it&apos;s graded.</p>}
        {graded ? (
          <section className="card max-w-3xl">
            <div className="flex items-center gap-3"><h2 className="font-semibold">Your result</h2><Badge tone="good">{mine!.score}/{a.maxScore}</Badge></div>
            {mine!.feedback && <p className="mt-3 text-sm">{mine!.feedback}</p>}
            <h3 className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-muted">Your answer</h3>
            <p className="whitespace-pre-line text-sm text-muted">{mine!.answer}</p>
          </section>
        ) : (
          <form action={submitAssignment} className="card max-w-3xl space-y-3">
            <input type="hidden" name="subjectId" value={subject.id} />
            <input type="hidden" name="assignmentId" value={a.id} />
            <label className="label" htmlFor="answer">Your answer</label>
            <textarea id="answer" name="answer" required rows={10} maxLength={8000} defaultValue={mine?.answer} className="input" />
            <button className="btn">{mine ? "Update submission" : "Submit"}</button>
            {mine && <p className="text-xs text-muted">Last submitted {mine.submittedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>}
          </form>
        )}
      </>
    );
  }

  // ───────── Teacher view ─────────
  const roster = await db.select().from(schema.students).where(eq(schema.students.classId, subject.classId)).orderBy(schema.students.rollNo);
  const subs = await db.select().from(schema.submissions).where(eq(schema.submissions.assignmentId, a.id));
  const bySt = new Map(subs.map((s) => [s.studentId, s]));

  return (
    <>
      {header}
      {sp.saved && <p role="status" className="mb-4 rounded-lg bg-good-soft px-4 py-2 text-sm text-good">Grade saved and added to the gradebook.</p>}
      {sp.suggested && <p role="status" className="mb-4 rounded-lg bg-brand-soft px-4 py-2 text-sm text-brand">AI suggestion added below. Review it, adjust if needed, then save the grade.</p>}
      {notice && <p role="alert" className="mb-4 rounded-lg bg-bad-soft px-4 py-2 text-sm text-bad">{notice}</p>}

      <h2 className="mb-3 text-sm font-semibold">Submissions ({subs.length}/{roster.length})</h2>
      <div className="space-y-4">
        {roster.map((st) => {
          const s = bySt.get(st.id);
          if (!s) {
            return (
              <div key={st.id} className="card flex items-center justify-between py-3">
                <span className="text-sm font-medium">{st.name}</span><Badge>Not submitted</Badge>
              </div>
            );
          }
          const isSuggestion = s.aiAssisted && !s.gradedAt;
          return (
            <article key={st.id} className="card">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{st.name}</h3>
                {s.gradedAt ? <Badge tone="good">Graded {s.score}/{a.maxScore}{s.aiAssisted ? " · AI-assisted" : ""}</Badge> : isSuggestion ? <Badge tone="brand">AI suggestion: review</Badge> : <Badge tone="warn">Needs grading</Badge>}
              </div>
              <p className="max-h-60 overflow-auto whitespace-pre-line rounded-lg bg-background p-3 text-sm">{s.answer}</p>
              <form className="mt-3 grid gap-3 sm:grid-cols-[110px_1fr]">
                <input type="hidden" name="subjectId" value={subject.id} />
                <input type="hidden" name="assignmentId" value={a.id} />
                <input type="hidden" name="submissionId" value={s.id} />
                <div>
                  <label className="label" htmlFor={`score-${s.id}`}>Score (/{a.maxScore})</label>
                  <input id={`score-${s.id}`} name="score" type="number" min={0} max={a.maxScore} step="any" required defaultValue={s.score ?? undefined} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor={`fb-${s.id}`}>Feedback to student</label>
                  <textarea id={`fb-${s.id}`} name="feedback" rows={2} maxLength={2000} defaultValue={s.feedback ?? ""} className="input" />
                </div>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button formAction={gradeSubmission} className="btn">{s.gradedAt ? "Update grade" : "Save grade"}</button>
                  {!s.gradedAt && (
                    <button formAction={suggestWithAi} formNoValidate className="btn-ghost">
                      <Sparkles className="size-4" aria-hidden /> {isSuggestion ? "Re-run AI suggestion" : "Suggest grade with AI"}
                    </button>
                  )}
                </div>
              </form>
            </article>
          );
        })}
      </div>
    </>
  );
}

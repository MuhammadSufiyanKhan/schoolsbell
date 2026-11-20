import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { requireCourse } from "@/lib/lms";
import { AI_NOTICES } from "@/lib/ai";
import { sumPoints } from "@/lib/tests";
import { Badge, Empty, PageHeader, Table } from "@/components/ui";
import { addQuestion, aiGradeAll, deleteQuestion, saveQuestion, setPublished, submitAttempt, updateTestDetails } from "./actions";

type Q = typeof schema.testQuestions.$inferSelect;

const NOTICES: Record<string, string> = {
  ...AI_NOTICES,
  has_attempts: "Students have already taken this test, so it can't be unpublished.",
  no_questions: "Add at least one question before publishing.",
};

/** Shared field set for adding and editing a question. */
function QuestionFields({ kind, q }: { kind: "mcq" | "short"; q?: Q }) {
  const idp = q ? `q${q.id}` : `new-${kind}`;
  return (
    <>
      <div className="sm:col-span-5">
        <label className="label" htmlFor={`${idp}-prompt`}>Question</label>
        <textarea id={`${idp}-prompt`} name="prompt" required rows={2} maxLength={2000} defaultValue={q?.prompt} className="input" />
      </div>
      <div>
        <label className="label" htmlFor={`${idp}-pts`}>Points</label>
        <input id={`${idp}-pts`} name="points" type="number" min={0.5} max={20} step={0.5} required defaultValue={q?.points ?? (kind === "mcq" ? 1 : 3)} className="input" />
      </div>
      {kind === "mcq" ? (
        <fieldset className="sm:col-span-6 space-y-2">
          <legend className="label">Options (select the correct one)</legend>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correctIndex" value={i} defaultChecked={q ? q.correctIndex === i : i === 0} aria-label={`Option ${i + 1} is correct`} className="size-4 accent-[var(--brand)]" />
              <input name="opt" defaultValue={q?.options?.[i] ?? ""} placeholder={`Option ${i + 1}${i < 2 ? "" : " (optional)"}`} aria-label={`Option ${i + 1}`} maxLength={500} className="input" />
            </div>
          ))}
        </fieldset>
      ) : (
        <div className="sm:col-span-6">
          <label className="label" htmlFor={`${idp}-model`}>Model answer / marking guide (used by you and the AI grader)</label>
          <textarea id={`${idp}-model`} name="modelAnswer" rows={2} maxLength={2000} defaultValue={q?.modelAnswer ?? ""} className="input" />
        </div>
      )}
    </>
  );
}

export default async function TestPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string; id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; published?: string; submitted?: string; aigraded?: string }>;
}) {
  const user = await requireUser(["admin", "teacher", "student"]);
  const { subjectId: sid, id } = await params;
  const sp = await searchParams;
  const { subject, cls, mode, student } = await requireCourse(user, Number(sid));
  const [test] = await db.select().from(schema.tests).where(and(eq(schema.tests.id, Number(id)), eq(schema.tests.subjectId, subject.id))).limit(1);
  if (!test || (mode === "learn" && !test.published)) notFound();
  const questions = await db.select().from(schema.testQuestions).where(eq(schema.testQuestions.testId, test.id)).orderBy(schema.testQuestions.position, schema.testQuestions.id);
  const total = sumPoints(questions);
  const notice = sp.error ? NOTICES[sp.error] : undefined;
  const back = `/courses/${subject.id}`;

  const head = (
    <>
      <Link href={back} className="mb-3 inline-block text-sm text-muted hover:text-foreground">← {subject.name}</Link>
      <PageHeader
        title={test.title}
        subtitle={`${cls.name}-${cls.section} · ${questions.length} questions · ${total} points`}
        action={mode === "manage" ? (test.published ? <Badge tone="good">Published</Badge> : <Badge tone="warn">Draft</Badge>) : undefined}
      />
      {test.instructions && <p className="mb-6 max-w-3xl whitespace-pre-line text-sm text-muted">{test.instructions}</p>}
      {notice && <p role="alert" className="mb-4 rounded-lg bg-bad-soft px-4 py-2 text-sm text-bad">{notice}</p>}
    </>
  );

  // ════════════════════════ STUDENT ════════════════════════
  if (mode === "learn") {
    const [attempt] = await db.select().from(schema.testAttempts).where(and(eq(schema.testAttempts.testId, test.id), eq(schema.testAttempts.studentId, student!.id))).limit(1);

    if (!attempt) {
      return (
        <>
          {head}
          <form action={submitAttempt} className="max-w-3xl space-y-4">
            <input type="hidden" name="subjectId" value={subject.id} />
            <input type="hidden" name="testId" value={test.id} />
            <p className="rounded-lg bg-warn-soft px-4 py-2 text-sm text-warn">You can submit this test once. Check your answers before submitting.</p>
            {questions.map((q, n) => (
              <fieldset key={q.id} className="card">
                <legend className="px-1 text-sm font-medium">{n + 1}. {q.prompt} <span className="font-normal text-muted">({q.points} pt{q.points === 1 ? "" : "s"})</span></legend>
                {q.kind === "mcq" ? (
                  <div className="mt-2 space-y-2">
                    {q.options?.map((o, i) => (
                      <label key={i} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="radio" name={`q_${q.id}`} value={i} className="size-4 accent-[var(--brand)]" /> {o}
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea name={`q_${q.id}`} rows={4} maxLength={4000} aria-label={`Answer to question ${n + 1}`} className="input mt-2" />
                )}
              </fieldset>
            ))}
            <button className="btn">Submit test</button>
          </form>
        </>
      );
    }

    const answers = await db.select().from(schema.testAnswers).where(eq(schema.testAnswers.attemptId, attempt.id));
    const released = attempt.status === "graded";
    return (
      <>
        {head}
        {sp.submitted && <p role="status" className="mb-4 max-w-3xl rounded-lg bg-good-soft px-4 py-2 text-sm text-good">Test submitted.</p>}
        {!released ? (
          <p className="card max-w-3xl text-sm">Your test is submitted. Your teacher will release your marks soon.</p>
        ) : (
          <div className="max-w-3xl space-y-4">
            <div className="card flex items-center gap-3"><h2 className="font-semibold">Your score</h2><Badge tone="good">{attempt.totalScore}/{total}</Badge></div>
            {questions.map((q, n) => {
              const a = answers.find((x) => x.questionId === q.id);
              return (
                <article key={q.id} className="card">
                  <p className="text-sm font-medium">{n + 1}. {q.prompt}</p>
                  {q.kind === "mcq" ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {q.options?.map((o, i) => (
                        <li key={i} className={i === q.correctIndex ? "text-good" : a?.selectedIndex === i ? "text-bad" : "text-muted"}>
                          {i === q.correctIndex ? "✓" : a?.selectedIndex === i ? "✗" : "·"} {o}{a?.selectedIndex === i ? " (your answer)" : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 whitespace-pre-line rounded-lg bg-background p-3 text-sm">{a?.answerText || <span className="text-muted">No answer</span>}</p>
                  )}
                  <p className="mt-2 text-xs text-muted">{a?.score ?? 0}/{q.points} points</p>
                  {a?.feedback && <p className="mt-1 text-sm">{a.feedback}</p>}
                </article>
              );
            })}
          </div>
        )}
      </>
    );
  }

  // ════════════════════════ TEACHER ════════════════════════
  const draft = !test.published;
  const roster = test.published ? await db.select().from(schema.students).where(eq(schema.students.classId, subject.classId)).orderBy(schema.students.rollNo) : [];
  const attempts = test.published ? await db.select().from(schema.testAttempts).where(eq(schema.testAttempts.testId, test.id)) : [];
  const byStudent = new Map(attempts.map((a) => [a.studentId, a]));
  const awaitingAi = attempts.filter((a) => a.status === "submitted").length;

  return (
    <>
      {head}
      {sp.saved && <p role="status" className="mb-4 rounded-lg bg-good-soft px-4 py-2 text-sm text-good">Saved.</p>}
      {sp.published && <p role="status" className="mb-4 rounded-lg bg-good-soft px-4 py-2 text-sm text-good">Published: students in {cls.name}-{cls.section} can now take this test.</p>}
      {sp.aigraded && <p role="status" className="mb-4 rounded-lg bg-brand-soft px-4 py-2 text-sm text-brand">AI graded {sp.aigraded} answers. Review each attempt, then release the marks to students.</p>}

      {test.aiGenerated && draft && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-brand-soft px-4 py-2 text-sm text-brand">
          <Sparkles className="size-4 shrink-0" aria-hidden /> AI-drafted test. Check every question and answer is correct before publishing.
        </p>
      )}

      {draft && (
        <form action={updateTestDetails} className="card mb-6 grid max-w-3xl gap-3">
          <input type="hidden" name="subjectId" value={subject.id} />
          <input type="hidden" name="testId" value={test.id} />
          <div><label className="label" htmlFor="t-title">Title</label><input id="t-title" name="title" required defaultValue={test.title} className="input" /></div>
          <div><label className="label" htmlFor="t-instr">Instructions for students</label><textarea id="t-instr" name="instructions" rows={2} defaultValue={test.instructions ?? ""} className="input" /></div>
          <div><button className="btn-ghost">Save details</button></div>
        </form>
      )}

      <section className="mb-8 max-w-3xl">
        <h2 className="mb-3 text-sm font-semibold">Questions</h2>
        {questions.length === 0 && <Empty>No questions yet. Add some below.</Empty>}
        <div className="space-y-3">
          {questions.map((q, n) =>
            draft ? (
              <form key={q.id} className="card grid gap-3 sm:grid-cols-6">
                <input type="hidden" name="subjectId" value={subject.id} />
                <input type="hidden" name="testId" value={test.id} />
                <input type="hidden" name="questionId" value={q.id} />
                <p className="text-xs font-medium text-muted sm:col-span-6">Question {n + 1} · {q.kind === "mcq" ? "Multiple choice" : "Short answer"}</p>
                <QuestionFields kind={q.kind} q={q} />
                <div className="flex gap-2 sm:col-span-6">
                  <button formAction={saveQuestion} className="btn-ghost">Save</button>
                  <button formAction={deleteQuestion} formNoValidate className="btn-ghost !text-bad">Delete</button>
                </div>
              </form>
            ) : (
              <article key={q.id} className="card">
                <p className="text-sm font-medium">{n + 1}. {q.prompt} <span className="font-normal text-muted">({q.points} pt{q.points === 1 ? "" : "s"})</span></p>
                {q.kind === "mcq" ? (
                  <ul className="mt-2 space-y-1 text-sm">{q.options?.map((o, i) => <li key={i} className={i === q.correctIndex ? "text-good" : "text-muted"}>{i === q.correctIndex ? "✓" : "·"} {o}</li>)}</ul>
                ) : (
                  q.modelAnswer && <p className="mt-2 text-sm text-muted"><span className="font-medium">Marking guide:</span> {q.modelAnswer}</p>
                )}
              </article>
            ),
          )}
        </div>

        {draft && (
          <div className="mt-4 space-y-3">
            {(["mcq", "short"] as const).map((kind) => (
              <details key={kind} className="card">
                <summary className="cursor-pointer text-sm font-medium">Add {kind === "mcq" ? "a multiple-choice question" : "a short-answer question"}</summary>
                <form action={addQuestion} className="mt-3 grid gap-3 sm:grid-cols-6">
                  <input type="hidden" name="subjectId" value={subject.id} />
                  <input type="hidden" name="testId" value={test.id} />
                  <input type="hidden" name="kind" value={kind} />
                  <QuestionFields kind={kind} />
                  <div className="sm:col-span-6"><button className="btn">Add question</button></div>
                </form>
              </details>
            ))}
          </div>
        )}

        <form action={setPublished} className="mt-5">
          <input type="hidden" name="subjectId" value={subject.id} />
          <input type="hidden" name="testId" value={test.id} />
          <input type="hidden" name="publish" value={draft ? "1" : "0"} />
          <button className={draft ? "btn" : "btn-ghost"}>{draft ? "Publish to students" : "Unpublish"}</button>
        </form>
      </section>

      {test.published && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Results ({attempts.length}/{roster.length} submitted)</h2>
            {awaitingAi > 0 && (
              <form action={aiGradeAll}>
                <input type="hidden" name="subjectId" value={subject.id} />
                <input type="hidden" name="testId" value={test.id} />
                <button className="btn"><Sparkles className="size-4" aria-hidden /> AI-grade {awaitingAi} pending {awaitingAi === 1 ? "attempt" : "attempts"}</button>
              </form>
            )}
          </div>
          <Table>
            <thead><tr><th className="th">Student</th><th className="th">Status</th><th className="th">Score</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-border">
              {roster.map((st) => {
                const a = byStudent.get(st.id);
                return (
                  <tr key={st.id}>
                    <td className="td font-medium">{st.name}</td>
                    <td className="td">
                      {!a ? <Badge>Not taken</Badge> : a.status === "graded" ? <Badge tone="good">Released</Badge> : a.status === "ai_graded" ? <Badge tone="brand">AI-graded: review</Badge> : <Badge tone="warn">Needs marking</Badge>}
                    </td>
                    <td className="td tabular-nums">{a && a.totalScore != null ? `${a.totalScore}/${total}` : "–"}</td>
                    <td className="td text-right">{a && <Link className="text-brand hover:underline" href={`/courses/${subject.id}/tests/${test.id}/attempts/${a.id}`}>Review</Link>}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </section>
      )}
    </>
  );
}

import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { requireCourse } from "@/lib/lms";
import { AI_NOTICES } from "@/lib/ai";
import { sumPoints } from "@/lib/tests";
import { Badge, PageHeader } from "@/components/ui";
import { aiGradeOne, releaseMarks } from "./actions";
import { idParam } from "@/lib/ids";

const NOTICES: Record<string, string> = {
  ...AI_NOTICES,
  unmarked: "Every question needs a score before you can release. Use “AI-grade short answers” or enter the marks yourself.",
  bad_score: "A score is outside the allowed range for its question.",
};

export default async function AttemptReview({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string; id: string; attemptId: string }>;
  searchParams: Promise<{ error?: string; aigraded?: string }>;
}) {
  const user = await requireUser(["admin", "teacher"]);
  const { subjectId: sid, id, attemptId } = await params;
  const sp = await searchParams;
  const { subject } = await requireCourse(user, idParam(sid), "manage");

  const [test] = await db.select().from(schema.tests).where(and(eq(schema.tests.id, idParam(id)), eq(schema.tests.subjectId, subject.id))).limit(1);
  if (!test) notFound();
  const [attempt] = await db.select().from(schema.testAttempts).where(and(eq(schema.testAttempts.id, idParam(attemptId)), eq(schema.testAttempts.testId, test.id))).limit(1);
  if (!attempt) notFound();
  const [student] = await db.select().from(schema.students).where(eq(schema.students.id, attempt.studentId)).limit(1);

  const questions = await db.select().from(schema.testQuestions).where(eq(schema.testQuestions.testId, test.id)).orderBy(schema.testQuestions.position, schema.testQuestions.id);
  const answers = await db.select().from(schema.testAnswers).where(eq(schema.testAnswers.attemptId, attempt.id));
  const total = sumPoints(questions);
  const shortUnmarked = answers.filter((a) => a.score == null).length;
  const hidden = { subjectId: subject.id, testId: test.id, attemptId: attempt.id };
  const notice = sp.error ? NOTICES[sp.error] : undefined;

  return (
    <>
      <Link href={`/courses/${subject.id}/tests/${test.id}`} className="mb-3 inline-block text-sm text-muted hover:text-foreground">← {test.title}</Link>
      <PageHeader
        title={student?.name ?? "Student"}
        subtitle={`Submitted ${attempt.submittedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · ${attempt.totalScore ?? "–"}/${total}`}
        action={attempt.status === "graded" ? <Badge tone="good">Released</Badge> : attempt.status === "ai_graded" ? <Badge tone="brand">AI-graded: review before release</Badge> : <Badge tone="warn">Needs marking</Badge>}
      />
      {notice && <p role="alert" className="mb-4 rounded-lg bg-bad-soft px-4 py-2 text-sm text-bad">{notice}</p>}
      {sp.aigraded && <p role="status" className="mb-4 rounded-lg bg-brand-soft px-4 py-2 text-sm text-brand">AI marks added. They are suggestions: check them, adjust where needed, then release.</p>}

      <form className="max-w-3xl space-y-4">
        {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {questions.map((q, n) => {
          const a = answers.find((x) => x.questionId === q.id);
          if (!a) return null;
          return (
            <article key={q.id} className="card">
              <p className="text-sm font-medium">{n + 1}. {q.prompt}</p>
              {q.kind === "mcq" ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {q.options?.map((o, i) => (
                    <li key={i} className={i === q.correctIndex ? "text-good" : a.selectedIndex === i ? "text-bad" : "text-muted"}>
                      {i === q.correctIndex ? "✓" : a.selectedIndex === i ? "✗" : "·"} {o}{a.selectedIndex === i ? " (student's answer)" : ""}
                    </li>
                  ))}
                  {a.selectedIndex == null && <li className="text-muted">No answer selected</li>}
                </ul>
              ) : (
                <>
                  <p className="mt-2 whitespace-pre-line rounded-lg bg-background p-3 text-sm">{a.answerText || <span className="text-muted">No answer</span>}</p>
                  {q.modelAnswer && <p className="mt-2 text-xs text-muted"><span className="font-medium">Marking guide:</span> {q.modelAnswer}</p>}
                </>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr]">
                <div>
                  <label className="label" htmlFor={`sc-${a.id}`}>Score (/{q.points}){a.aiGraded ? " · AI" : ""}</label>
                  <input id={`sc-${a.id}`} name={`score_${a.id}`} type="number" min={0} max={q.points} step="any" defaultValue={a.score ?? undefined} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor={`fb-${a.id}`}>Feedback</label>
                  <input id={`fb-${a.id}`} name={`fb_${a.id}`} maxLength={600} defaultValue={a.feedback ?? ""} className="input" />
                </div>
              </div>
            </article>
          );
        })}
        <div className="flex flex-wrap gap-2">
          <button formAction={releaseMarks} className="btn">{attempt.status === "graded" ? "Update released marks" : "Release marks to student"}</button>
          {shortUnmarked > 0 && (
            <button formAction={aiGradeOne} formNoValidate className="btn-ghost"><Sparkles className="size-4" aria-hidden /> AI-grade short answers</button>
          )}
        </div>
      </form>
    </>
  );
}

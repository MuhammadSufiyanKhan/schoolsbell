import Link from "next/link";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { requireCourse } from "@/lib/lms";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { addAssignment, addMaterial, createBlankTest, deleteMaterial } from "./actions";
import { AiTestForm } from "./ai-test-form";
import { idParam } from "@/lib/ids";

const NOTICES: Record<string, string> = {
  bad_url: "That link isn't valid. Links must start with http:// or https://.",
  bad_material: "Give the material a title and either some text or a link.",
};

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser(["admin", "teacher", "student"]);
  const { subjectId: sid } = await params;
  const sp = await searchParams;
  const { subject, cls, mode, student } = await requireCourse(user, idParam(sid));
  const manage = mode === "manage";
  const subjectId = subject.id;

  const [materials, assignments, allTests] = await Promise.all([
    db.select().from(schema.materials).where(eq(schema.materials.subjectId, subjectId)).orderBy(desc(schema.materials.createdAt)),
    db.select().from(schema.assignments).where(eq(schema.assignments.subjectId, subjectId)).orderBy(desc(schema.assignments.dueDate)),
    db.select().from(schema.tests).where(eq(schema.tests.subjectId, subjectId)).orderBy(desc(schema.tests.createdAt)),
  ]);
  const tests = manage ? allTests : allTests.filter((t) => t.published);
  const aIds = assignments.map((a) => a.id);
  const tIds = tests.map((t) => t.id);

  // Manager: counts. Learner: their own submissions / attempts.
  const [subs, attempts, qCounts] = await Promise.all([
    aIds.length
      ? db.select().from(schema.submissions).where(manage ? inArray(schema.submissions.assignmentId, aIds) : and(inArray(schema.submissions.assignmentId, aIds), eq(schema.submissions.studentId, student!.id)))
      : [],
    tIds.length
      ? db.select().from(schema.testAttempts).where(manage ? inArray(schema.testAttempts.testId, tIds) : and(inArray(schema.testAttempts.testId, tIds), eq(schema.testAttempts.studentId, student!.id)))
      : [],
    tIds.length ? db.select({ testId: schema.testQuestions.testId, n: count() }).from(schema.testQuestions).where(inArray(schema.testQuestions.testId, tIds)).groupBy(schema.testQuestions.testId) : [],
  ]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Link href="/courses" className="mb-3 inline-block text-sm text-muted hover:text-foreground">← Courses</Link>
      <PageHeader title={subject.name} subtitle={`${cls.name}-${cls.section}${manage ? "" : ""}`} />

      {sp.error && NOTICES[sp.error] && <p role="alert" className="mb-4 rounded-lg bg-bad-soft px-4 py-2 text-sm text-bad">{NOTICES[sp.error]}</p>}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        {/* ───────── Materials ───────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold">Materials</h2>
          {materials.length === 0 ? <Empty>No materials yet.</Empty> : (
            <div className="space-y-3">
              {materials.map((m) => (
                <article key={m.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium">{m.title}</h3>
                    {manage && (
                      <form action={deleteMaterial}>
                        <input type="hidden" name="subjectId" value={subjectId} />
                        <input type="hidden" name="id" value={m.id} />
                        <button className="text-xs text-muted hover:text-bad" aria-label={`Delete ${m.title}`}>Delete</button>
                      </form>
                    )}
                  </div>
                  {m.body && <p className="mt-2 whitespace-pre-line text-sm">{m.body}</p>}
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-brand hover:underline">
                      Open link <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
          {manage && (
            <form action={addMaterial} className="card mt-3 space-y-3">
              <input type="hidden" name="subjectId" value={subjectId} />
              <p className="text-sm font-medium">Add material</p>
              <input name="title" required placeholder="Title" aria-label="Material title" className="input" />
              <textarea name="body" rows={3} placeholder="Notes or instructions (optional)" aria-label="Material text" className="input" />
              <input name="url" placeholder="https:// link (optional)" aria-label="Material link" className="input" />
              <button className="btn">Add</button>
            </form>
          )}
        </section>

        {/* ───────── Assignments ───────── */}
        <section>
          <h2 className="mb-3 text-sm font-semibold">Assignments</h2>
          {assignments.length === 0 ? <Empty>No assignments yet.</Empty> : (
            <div className="space-y-3">
              {assignments.map((a) => {
                const mine = subs.find((s) => s.assignmentId === a.id);
                const submitted = subs.filter((s) => s.assignmentId === a.id);
                const graded = submitted.filter((s) => s.gradedAt).length;
                return (
                  <Link key={a.id} href={`/courses/${subjectId}/assignments/${a.id}`} className="card block transition hover:border-brand">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium">{a.title}</h3>
                      {manage ? (
                        <Badge tone="brand">{submitted.length} submitted · {graded} graded</Badge>
                      ) : mine?.gradedAt ? (
                        <Badge tone="good">{mine.score}/{a.maxScore}</Badge>
                      ) : mine ? (
                        <Badge tone="warn">Submitted</Badge>
                      ) : a.dueDate < today ? (
                        <Badge tone="bad">Overdue</Badge>
                      ) : (
                        <Badge>To do</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted">Due {a.dueDate} · {a.maxScore} points</p>
                  </Link>
                );
              })}
            </div>
          )}
          {manage && (
            <form action={addAssignment} className="card mt-3 grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="subjectId" value={subjectId} />
              <p className="text-sm font-medium sm:col-span-3">New assignment</p>
              <input name="title" required placeholder="Title" aria-label="Assignment title" className="input sm:col-span-3" />
              <textarea name="instructions" required rows={3} placeholder="Instructions" aria-label="Assignment instructions" className="input sm:col-span-3" />
              <div><label className="label" htmlFor="a-due">Due date</label><input id="a-due" name="dueDate" type="date" required className="input" /></div>
              <div><label className="label" htmlFor="a-max">Points</label><input id="a-max" name="maxScore" type="number" min={1} defaultValue={100} className="input" /></div>
              <div className="flex items-end"><button className="btn w-full">Create</button></div>
            </form>
          )}
        </section>

        {/* ───────── Tests ───────── */}
        <section className="xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Tests</h2>
          {tests.length === 0 ? <Empty>{manage ? "No tests yet. Generate one with AI or build your own below." : "No tests available."}</Empty> : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {tests.map((t) => {
                const mine = attempts.find((x) => x.testId === t.id);
                const taken = attempts.filter((x) => x.testId === t.id);
                const needsReview = taken.filter((x) => x.status !== "graded").length;
                return (
                  <Link key={t.id} href={`/courses/${subjectId}/tests/${t.id}`} className="card block transition hover:border-brand">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium">{t.title}</h3>
                      {manage ? (
                        t.published ? <Badge tone="good">Published</Badge> : <Badge tone="warn">Draft</Badge>
                      ) : mine?.status === "graded" ? (
                        <Badge tone="good">Score {mine.totalScore}</Badge>
                      ) : mine ? (
                        <Badge tone="warn">Awaiting marks</Badge>
                      ) : (
                        <Badge tone="brand">Take test</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {qCounts.find((q) => q.testId === t.id)?.n ?? 0} questions
                      {t.aiGenerated && " · AI-drafted"}
                      {manage && taken.length > 0 && ` · ${taken.length} attempts${needsReview ? `, ${needsReview} to review` : ""}`}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}

          {manage && (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
              <div className="card">
                <h3 className="mb-3 text-sm font-medium">Create a test with AI</h3>
                <AiTestForm subjectId={subjectId} />
              </div>
              <form action={createBlankTest} className="card space-y-3">
                <input type="hidden" name="subjectId" value={subjectId} />
                <h3 className="text-sm font-medium">Or build one yourself</h3>
                <input name="title" required placeholder="Test title" aria-label="Test title" className="input" />
                <button className="btn-ghost w-full">Create blank test</button>
              </form>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

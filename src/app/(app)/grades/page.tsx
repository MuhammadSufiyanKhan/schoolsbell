import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { visibleClasses, visibleStudents } from "@/lib/scope";
import { gradeAverages, letter } from "@/lib/analytics";
import { Badge, Empty, PageHeader, Table } from "@/components/ui";
import { saveGrades, addAssessment } from "./actions";

export default async function GradesPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; assessment?: string; saved?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  if (user.role === "student" || user.role === "parent") {
    const kids = await visibleStudents(user);
    const ids = kids.map((k) => k.id);
    const [avgs, rows] = await Promise.all([
      gradeAverages(ids),
      ids.length
        ? db
            .select({ studentId: schema.grades.studentId, subject: schema.subjects.name, title: schema.assessments.title, score: schema.grades.score, max: schema.assessments.maxScore, date: schema.assessments.date })
            .from(schema.grades)
            .innerJoin(schema.assessments, eq(schema.assessments.id, schema.grades.assessmentId))
            .innerJoin(schema.subjects, eq(schema.subjects.id, schema.assessments.subjectId))
            .where(inArray(schema.grades.studentId, ids))
            .orderBy(schema.assessments.date)
        : [],
    ]);
    return (
      <>
        <PageHeader title="Grades" subtitle="Weighted results across all subjects." />
        {kids.map((k) => (
          <section key={k.id} className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-sm font-semibold">{k.name}</h2>
              <Badge tone="brand">{avgs.get(k.id) ?? "–"}% · {letter(avgs.get(k.id) ?? null)}</Badge>
            </div>
            <Table>
              <thead><tr><th className="th">Subject</th><th className="th">Assessment</th><th className="th">Date</th><th className="th">Score</th></tr></thead>
              <tbody className="divide-y divide-border">
                {rows.filter((r) => r.studentId === k.id).map((r, i) => (
                  <tr key={i}><td className="td">{r.subject}</td><td className="td text-muted">{r.title}</td><td className="td text-muted">{r.date}</td><td className="td tabular-nums">{r.score}/{r.max}</td></tr>
                ))}
              </tbody>
            </Table>
          </section>
        ))}
      </>
    );
  }

  // Staff: pick subject -> assessment -> enter scores
  const classes = await visibleClasses(user);
  const classIds = classes.map((c) => c.id);
  const subjectQuery = classIds.length
    ? db.select().from(schema.subjects).where(
        user.role === "admin"
          ? inArray(schema.subjects.classId, classIds)
          : and(inArray(schema.subjects.classId, classIds), eq(schema.subjects.teacherId, user.id)),
      )
    : null;
  const subjects = subjectQuery ? await subjectQuery : [];
  const subjectId = Number(sp.subject ?? subjects[0]?.id);
  const subject = subjects.find((s) => s.id === subjectId);
  const cls = classes.find((c) => c.id === subject?.classId);
  const assessments = subject ? await db.select().from(schema.assessments).where(eq(schema.assessments.subjectId, subject.id)).orderBy(schema.assessments.date) : [];
  const assessment = assessments.find((a) => a.id === Number(sp.assessment)) ?? assessments[0];
  const roster = subject ? (await visibleStudents(user)).filter((s) => s.classId === subject.classId) : [];
  const scores = assessment && roster.length
    ? await db.select().from(schema.grades).where(and(eq(schema.grades.assessmentId, assessment.id), inArray(schema.grades.studentId, roster.map((r) => r.id))))
    : [];
  const byStudent = new Map(scores.map((g) => [g.studentId, g.score]));

  return (
    <>
      <PageHeader title="Gradebook" subtitle="Enter scores per assessment. Weighted averages update automatically." />
      {subjects.length === 0 ? <Empty>You have no subjects assigned.</Empty> : (
        <>
          <form className="mb-5 flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="subject">Subject</label>
              <select id="subject" name="subject" defaultValue={subjectId} className="input">
                {subjects.map((s) => {
                  const c = classes.find((c) => c.id === s.classId);
                  return <option key={s.id} value={s.id}>{s.name} · {c?.name}-{c?.section}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="assessment">Assessment</label>
              <select id="assessment" name="assessment" defaultValue={assessment?.id} className="input">
                {assessments.map((a) => <option key={a.id} value={a.id}>{a.title} (/{a.maxScore})</option>)}
              </select>
            </div>
            <button className="btn-ghost">Load</button>
          </form>

          {sp.saved && <p role="status" className="mb-4 rounded-lg bg-good-soft px-4 py-2 text-sm text-good">Scores saved.</p>}

          {assessment && (
            <form action={saveGrades}>
              <input type="hidden" name="assessmentId" value={assessment.id} />
              <input type="hidden" name="subjectId" value={subjectId} />
              <Table>
                <thead><tr><th className="th">Student</th><th className="th">Score (max {assessment.maxScore})</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {roster.map((s) => (
                    <tr key={s.id}>
                      <td className="td font-medium">{s.name}</td>
                      <td className="td">
                        <input name={`g_${s.id}`} type="number" min={0} max={assessment.maxScore} step="any" defaultValue={byStudent.get(s.id)} aria-label={`Score for ${s.name}`} className="input w-28" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <button className="btn mt-4">Save scores</button>
            </form>
          )}

          {subject && cls && (
            <section className="card mt-8 max-w-xl">
              <h2 className="mb-4 text-sm font-semibold">New assessment for {subject.name} ({cls.name}-{cls.section})</h2>
              <form action={addAssessment} className="grid gap-3 sm:grid-cols-4">
                <input type="hidden" name="subjectId" value={subject.id} />
                <div className="sm:col-span-4"><label className="label" htmlFor="title">Title</label><input id="title" name="title" required className="input" /></div>
                <div><label className="label" htmlFor="maxScore">Max</label><input id="maxScore" name="maxScore" type="number" defaultValue={100} min={1} className="input" /></div>
                <div><label className="label" htmlFor="weight">Weight</label><input id="weight" name="weight" type="number" defaultValue={1} min={0.1} step="0.1" className="input" /></div>
                <div className="sm:col-span-2"><label className="label" htmlFor="adate">Date</label><input id="adate" name="date" type="date" required className="input" /></div>
                <div className="sm:col-span-4"><button className="btn">Create assessment</button></div>
              </form>
            </section>
          )}
        </>
      )}
    </>
  );
}

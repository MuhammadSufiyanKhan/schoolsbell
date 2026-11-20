import { notFound } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { visibleStudents } from "@/lib/scope";
import { attendanceRates, gradeAverages, letter, riskReasons } from "@/lib/analytics";
import { Badge, PageHeader, Stat, Table } from "@/components/ui";

export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(["admin", "teacher"]);
  const { id } = await params;
  const sid = Number(id);
  const allowed = await visibleStudents(user);
  const student = allowed.find((s) => s.id === sid);
  if (!student) notFound();

  const [att, grades] = await Promise.all([attendanceRates([sid]), gradeAverages([sid])]);
  const a = att.get(sid)?.rate ?? null;
  const g = grades.get(sid) ?? null;

  const rows = await db
    .select({
      subject: schema.subjects.name,
      title: schema.assessments.title,
      score: schema.grades.score,
      max: schema.assessments.maxScore,
      date: schema.assessments.date,
    })
    .from(schema.grades)
    .innerJoin(schema.assessments, eq(schema.assessments.id, schema.grades.assessmentId))
    .innerJoin(schema.subjects, eq(schema.subjects.id, schema.assessments.subjectId))
    .where(eq(schema.grades.studentId, sid))
    .orderBy(desc(schema.assessments.date));

  const recentAtt = await db
    .select()
    .from(schema.attendance)
    .where(eq(schema.attendance.studentId, sid))
    .orderBy(desc(schema.attendance.date))
    .limit(10);

  const reasons = riskReasons(a, g);

  return (
    <>
      <Link href="/students" className="mb-3 inline-block text-sm text-muted hover:text-foreground">← Students</Link>
      <PageHeader
        title={student.name}
        subtitle={`Roll no ${student.rollNo}${student.dob ? ` · Born ${student.dob}` : ""}`}
        action={reasons.length ? <Badge tone="warn">Needs attention: {reasons.join(", ")}</Badge> : <Badge tone="good">On track</Badge>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Attendance (28d)" value={a != null ? `${a}%` : "–"} tone={a == null ? undefined : a >= 90 ? "good" : a >= 85 ? "warn" : "bad"} />
        <Stat label="Grade average" value={g != null ? `${g}%` : "–"} hint={`Letter ${letter(g)}`} />
        <Stat label="Absences (28d)" value={att.get(sid)?.absent ?? 0} />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold">Assessments</h2>
          <Table>
            <thead><tr><th className="th">Subject</th><th className="th">Assessment</th><th className="th">Score</th></tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={i}><td className="td">{r.subject}</td><td className="td text-muted">{r.title}</td><td className="td tabular-nums">{r.score}/{r.max}</td></tr>
              ))}
            </tbody>
          </Table>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold">Recent attendance</h2>
          <Table>
            <thead><tr><th className="th">Date</th><th className="th">Status</th></tr></thead>
            <tbody className="divide-y divide-border">
              {recentAtt.map((r) => (
                <tr key={r.id}>
                  <td className="td">{r.date}</td>
                  <td className="td"><Badge tone={r.status === "present" ? "good" : r.status === "absent" ? "bad" : "warn"}>{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      </div>
    </>
  );
}

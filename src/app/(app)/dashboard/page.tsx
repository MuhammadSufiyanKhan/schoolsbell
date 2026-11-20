import Link from "next/link";
import { and, count, desc, eq, isNull, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { visibleStudents } from "@/lib/scope";
import { attendanceRates, gradeAverages, riskReasons } from "@/lib/analytics";
import { Badge, PageHeader, Stat, Table, money } from "@/components/ui";

export default async function Dashboard() {
  const user = await requireUser();
  const students = await visibleStudents(user);
  const ids = students.map((s) => s.id);
  const [att, grades] = await Promise.all([attendanceRates(ids), gradeAverages(ids)]);

  const rates = [...att.values()].filter((a) => a.rate != null);
  const avgAtt = rates.length ? Math.round(rates.reduce((s, a) => s + a.rate!, 0) / rates.length) : null;
  const gvals = [...grades.values()].filter((g): g is number => g != null);
  const avgGrade = gvals.length ? Math.round(gvals.reduce((s, g) => s + g, 0) / gvals.length) : null;

  const unpaid = ids.length
    ? await db
        .select({ amount: schema.invoices.amountCents })
        .from(schema.invoices)
        .where(and(inArray(schema.invoices.studentId, ids), isNull(schema.invoices.paidAt)))
    : [];
  const outstanding = unpaid.reduce((s, i) => s + i.amount, 0);

  const atRisk = students
    .map((s) => ({ s, reasons: riskReasons(att.get(s.id)?.rate ?? null, grades.get(s.id) ?? null) }))
    .filter((x) => x.reasons.length);

  const audience = { admin: null, teacher: "teachers", student: "students", parent: "parents" }[user.role];
  const news = await db
    .select()
    .from(schema.announcements)
    .where(eq(schema.announcements.schoolId, user.schoolId))
    .orderBy(desc(schema.announcements.createdAt))
    .limit(10);
  const visibleNews = news.filter((n) => n.audience === "all" || !audience || n.audience === audience).slice(0, 3);

  const isStaff = user.role === "admin" || user.role === "teacher";
  const [{ n: teacherCount }] = user.role === "admin"
    ? await db.select({ n: count() }).from(schema.users).where(and(eq(schema.users.schoolId, user.schoolId), eq(schema.users.role, "teacher")))
    : [{ n: 0 }];

  return (
    <>
      <PageHeader title={`Welcome back, ${user.name.replace(/^(Mr|Mrs|Ms|Dr|Principal)\.?\s+/i, "").split(" ")[0]}`} subtitle={isStaff ? "Here's how your school is doing." : "Here's how your child is doing."} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={isStaff ? "Students" : "Children"} value={students.length} hint={user.role === "admin" ? `${teacherCount} teachers` : undefined} />
        <Stat label="Attendance (28d)" value={avgAtt != null ? `${avgAtt}%` : "–"} tone={avgAtt == null ? undefined : avgAtt >= 90 ? "good" : avgAtt >= 85 ? "warn" : "bad"} />
        <Stat label="Average grade" value={avgGrade != null ? `${avgGrade}%` : "–"} tone={avgGrade == null ? undefined : avgGrade >= 70 ? "good" : avgGrade >= 50 ? "warn" : "bad"} />
        {user.role !== "teacher" && <Stat label="Fees outstanding" value={money(outstanding)} tone={outstanding ? "warn" : "good"} />}
        {user.role === "teacher" && <Stat label="Need attention" value={atRisk.length} tone={atRisk.length ? "warn" : "good"} />}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {isStaff ? (
          <section>
            <h2 className="mb-3 text-sm font-semibold">Early-warning: students who may need support</h2>
            {atRisk.length === 0 ? (
              <p className="card text-sm text-muted">No students flagged. 🎉</p>
            ) : (
              <Table>
                <thead><tr><th className="th">Student</th><th className="th">Why flagged</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {atRisk.map(({ s, reasons }) => (
                    <tr key={s.id}>
                      <td className="td font-medium"><Link className="hover:underline" href={`/students/${s.id}`}>{s.name}</Link><span className="ml-2 text-xs text-muted">{s.rollNo}</span></td>
                      <td className="td">{reasons.map((r) => <Badge key={r} tone="warn">{r}</Badge>)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="mt-2 text-xs text-muted">Rule-based: attendance below 85% or grade average below 50%. Teachers should review before acting.</p>
          </section>
        ) : (
          <section>
            <h2 className="mb-3 text-sm font-semibold">Your children</h2>
            <Table>
              <thead><tr><th className="th">Name</th><th className="th">Attendance</th><th className="th">Grade</th></tr></thead>
              <tbody className="divide-y divide-border">
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="td font-medium">{s.name}</td>
                    <td className="td">{att.get(s.id)?.rate ?? "–"}%</td>
                    <td className="td">{grades.get(s.id) ?? "–"}%</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold">Latest announcements</h2>
          <div className="space-y-3">
            {visibleNews.map((n) => (
              <article key={n.id} className="card">
                <h3 className="text-sm font-medium">{n.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{n.body}</p>
              </article>
            ))}
            {visibleNews.length === 0 && <p className="card text-sm text-muted">Nothing new.</p>}
            <Link href="/announcements" className="text-sm text-brand hover:underline">All announcements →</Link>
          </div>
        </section>
      </div>
    </>
  );
}

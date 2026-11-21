import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { visibleClasses } from "@/lib/scope";
import { idParam } from "@/lib/ids";
import { attendanceRates, gradeAverages, letter, riskReasons } from "@/lib/analytics";
import { Badge, Empty, PageHeader, Stat, Table } from "@/components/ui";
import { formatPkMobile, telHref } from "@/lib/pk";

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

/** Everything about one class's students in one place. Staff only; teachers only see classes they teach. */
export default async function ClassDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser(["admin", "teacher"]);
  const id = idParam((await params).id);
  const { q = "" } = await searchParams;

  // Same rule as the Classes list: another school's (or another teacher's) class is simply not found.
  const cls = (await visibleClasses(user)).find((c) => c.id === id);
  if (!cls) notFound();
  const isAdmin = user.role === "admin";

  const [students, subjects, teacher] = await Promise.all([
    db.select().from(schema.students).where(eq(schema.students.classId, id)).orderBy(schema.students.rollNo),
    db.select().from(schema.subjects).where(eq(schema.subjects.classId, id)).orderBy(schema.subjects.name),
    cls.teacherId ? db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, cls.teacherId)).limit(1) : Promise.resolve([]),
  ]);
  const ids = students.map((s) => s.id);
  const loginIds = students.map((s) => s.userId).filter((x): x is number => x != null);
  const [att, grades, logins, subjectTeachers] = await Promise.all([
    attendanceRates(ids),
    gradeAverages(ids),
    isAdmin && loginIds.length ? db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users).where(inArray(schema.users.id, loginIds)) : Promise.resolve([]),
    subjects.some((s) => s.teacherId) ? db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, subjects.map((s) => s.teacherId).filter((x): x is number => x != null))) : Promise.resolve([]),
  ]);
  const email = new Map(logins.map((l) => [l.id, l.email]));
  const tName = new Map(subjectTeachers.map((t) => [t.id, t.name]));

  const needle = q.trim().toLowerCase();
  const list = needle ? students.filter((s) => s.name.toLowerCase().includes(needle) || s.rollNo.toLowerCase().includes(needle) || (s.guardianName ?? "").toLowerCase().includes(needle)) : students;
  const rates = ids.map((i) => att.get(i)?.rate ?? null);
  const gs = ids.map((i) => grades.get(i) ?? null);
  const atRisk = ids.filter((i) => riskReasons(att.get(i)?.rate ?? null, grades.get(i) ?? null).length).length;

  return (
    <>
      <Link href="/classes" className="mb-3 inline-flex items-center gap-1.5 text-sm text-brand hover:underline"><ArrowLeft className="size-4" aria-hidden /> All classes</Link>
      <PageHeader title={`${cls.name} – ${cls.section}`} subtitle={`Class teacher: ${teacher[0]?.name ?? "not assigned"}`} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Students" value={students.length} />
        <Stat label="Average attendance (4 weeks)" value={avg(rates) == null ? "–" : `${avg(rates)}%`} />
        <Stat label="Average grade" value={avg(gs) == null ? "–" : `${avg(gs)}% (${letter(avg(gs))})`} />
        <Stat label="Need attention" value={atRisk} />
      </div>

      {subjects.length > 0 && (
        <section className="card mb-6">
          <h2 className="mb-2 text-sm font-semibold">Subjects and teachers</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {subjects.map((s) => (
              <li key={s.id} className="rounded-full bg-brand-soft px-3 py-1 text-brand">{s.name}<span className="text-muted"> · {s.teacherId ? tName.get(s.teacherId) ?? "—" : "unassigned"}</span></li>
            ))}
          </ul>
        </section>
      )}

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search name, roll no or guardian…" className="input max-w-xs" aria-label="Search this class" />
        <button className="btn-ghost">Search</button>
        {q && <Link href={`/classes/${id}`} className="btn-ghost">Clear</Link>}
      </form>

      {students.length === 0 ? (
        <Empty>No students in this class yet.</Empty>
      ) : list.length === 0 ? (
        <Empty>No student in this class matches &ldquo;{q}&rdquo;.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className="th">Roll no</th><th className="th">Student</th><th className="th">Born</th>
              <th className="th">Guardian</th>{isAdmin && <th className="th">Guardian CNIC</th>}{isAdmin && <th className="th">Login</th>}
              <th className="th">Attendance</th><th className="th">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border" data-testid="class-students">
            {list.map((s) => {
              const a = att.get(s.id)?.rate ?? null;
              const g = grades.get(s.id) ?? null;
              const risk = riskReasons(a, g);
              return (
                <tr key={s.id} className="hover:bg-brand-soft/40">
                  <td className="td text-muted">{s.rollNo}</td>
                  <td className="td font-medium">
                    <Link className="hover:underline" href={`/students/${s.id}`}>{s.name}</Link>
                    {risk.length > 0 && <p className="text-xs font-normal text-bad">Needs attention: {risk.join(", ")}</p>}
                  </td>
                  <td className="td text-muted">{s.dob ?? "–"}</td>
                  <td className="td">
                    {s.guardianName || s.guardianPhone ? (
                      <>
                        <p>{s.guardianName ?? "—"}</p>
                        {s.guardianPhone && <a href={telHref(s.guardianPhone)} className="text-xs text-brand hover:underline">{formatPkMobile(s.guardianPhone)}</a>}
                      </>
                    ) : <span className="text-muted">—</span>}
                  </td>
                  {isAdmin && <td className="td text-muted">{s.guardianCnic ?? "—"}</td>}
                  {isAdmin && <td className="td text-xs text-muted">{s.userId ? email.get(s.userId) ?? "—" : "no login"}</td>}
                  <td className="td"><Badge tone={a == null ? "neutral" : a >= 90 ? "good" : a >= 85 ? "warn" : "bad"}>{a ?? "–"}%</Badge></td>
                  <td className="td">{g ?? "–"}% <span className="text-muted">({letter(g)})</span></td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}

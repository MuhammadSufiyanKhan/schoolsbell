import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { idParam } from "@/lib/ids";
import { formatPkMobile, telHref, isSpecialist } from "@/lib/pk";
import { Badge, PageHeader, Stat, Table } from "@/components/ui";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

const none = <span className="text-muted">Not recorded</span>;

export default async function TeacherDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser(["admin"]);
  const { id } = await params;
  // Scoped to the caller's school: another school's teacher is a 404, not a 403.
  const [t] = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.id, idParam(id)), eq(schema.users.schoolId, me.schoolId), eq(schema.users.role, "teacher")))
    .limit(1);
  if (!t) notFound();

  const [subjects, homeroom] = await Promise.all([
    db
      .select({ id: schema.subjects.id, name: schema.subjects.name, classId: schema.subjects.classId, cls: schema.classes.name, section: schema.classes.section })
      .from(schema.subjects)
      .innerJoin(schema.classes, eq(schema.classes.id, schema.subjects.classId))
      .where(and(eq(schema.subjects.teacherId, t.id), eq(schema.subjects.schoolId, me.schoolId)))
      .orderBy(schema.classes.name, schema.subjects.name),
    db.select().from(schema.classes).where(and(eq(schema.classes.teacherId, t.id), eq(schema.classes.schoolId, me.schoolId))),
  ]);

  const subjectIds = subjects.map((s) => s.id);
  const classIds = [...new Set([...subjects.map((s) => s.classId), ...homeroom.map((c) => c.id)])];
  const [studentCounts, materials, assignments, tests] = await Promise.all([
    classIds.length ? db.select({ classId: schema.students.classId, n: count() }).from(schema.students).where(inArray(schema.students.classId, classIds)).groupBy(schema.students.classId) : [],
    subjectIds.length ? db.select({ subjectId: schema.materials.subjectId, n: count() }).from(schema.materials).where(inArray(schema.materials.subjectId, subjectIds)).groupBy(schema.materials.subjectId) : [],
    subjectIds.length ? db.select({ subjectId: schema.assignments.subjectId, n: count() }).from(schema.assignments).where(inArray(schema.assignments.subjectId, subjectIds)).groupBy(schema.assignments.subjectId) : [],
    subjectIds.length ? db.select({ subjectId: schema.tests.subjectId, n: count() }).from(schema.tests).where(inArray(schema.tests.subjectId, subjectIds)).groupBy(schema.tests.subjectId) : [],
  ]);
  const n = (rows: { n: number; classId?: number | null; subjectId?: number }[], key: "classId" | "subjectId", v: number) => rows.find((r) => r[key] === v)?.n ?? 0;

  // Distinct students taught (a class counted once even if they teach it several subjects).
  const teachingClassIds = [...new Set(subjects.map((s) => s.classId))];
  const studentsTaught = teachingClassIds.reduce((sum, c) => sum + n(studentCounts, "classId", c), 0);
  const outside = t.specializations.length > 0 ? subjects.filter((s) => !isSpecialist(t.specializations, s.name)) : [];

  return (
    <>
      <Link href="/teachers" className="mb-3 inline-block text-sm text-muted hover:text-foreground">← Teachers</Link>
      <PageHeader
        title={t.name}
        subtitle={`Teacher · ${t.email}`}
        action={<Link href={`/people/${t.id}`} className="btn-ghost">Edit details</Link>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Subjects taught" value={subjects.length} />
        <Stat label="Students taught" value={studentsTaught} hint={teachingClassIds.length ? `across ${teachingClassIds.length} ${teachingClassIds.length === 1 ? "class" : "classes"}` : undefined} />
        <Stat label="Class teacher of" value={homeroom.length ? homeroom.map((c) => `${c.name}-${c.section}`).join(", ") : "—"} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 text-sm font-semibold">Contact &amp; identity</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Row label="Full name">{t.name}</Row>
            <Row label="Mobile">{t.phone ? <a href={telHref(t.phone)} className="text-brand hover:underline">{formatPkMobile(t.phone)}</a> : none}</Row>
            <Row label="ID card (CNIC)">{t.cnic ? <span className="tabular-nums">{t.cnic}</span> : none}</Row>
            <Row label="Email (login)"><span className="break-all">{t.email}</span></Row>
            <Row label="Account created">{t.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</Row>
            <Row label="Role">Teacher</Row>
          </dl>
        </section>

        <section className="card">
          <h2 className="mb-4 text-sm font-semibold">Specialisations</h2>
          {t.specializations.length === 0 ? (
            <p className="text-sm text-muted">None recorded. Add the subjects they&apos;re qualified to teach under Edit details, so the right teacher is suggested when assigning subjects.</p>
          ) : (
            <div className="flex flex-wrap gap-2">{t.specializations.map((s) => <Badge key={s} tone="brand">{s}</Badge>)}</div>
          )}
          {outside.length > 0 && (
            <p className="mt-4 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
              Currently teaching outside their listed specialisations: {outside.map((s) => `${s.name} (${s.cls}-${s.section})`).join(", ")}.
            </p>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">Teaching assignments</h2>
        {subjects.length === 0 ? (
          <p className="card text-sm text-muted">Not assigned to any subject yet. Assign them under Classes.</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className="th">Subject</th><th className="th">Class</th><th className="th">Students</th>
                <th className="th">Materials</th><th className="th">Assignments</th><th className="th">Tests</th><th className="th">Fit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td className="td"><Link href={`/courses/${s.id}`} className="font-medium hover:underline">{s.name}</Link></td>
                  <td className="td">{s.cls}-{s.section}</td>
                  <td className="td tabular-nums">{n(studentCounts, "classId", s.classId)}</td>
                  <td className="td tabular-nums">{n(materials, "subjectId", s.id)}</td>
                  <td className="td tabular-nums">{n(assignments, "subjectId", s.id)}</td>
                  <td className="td tabular-nums">{n(tests, "subjectId", s.id)}</td>
                  <td className="td">
                    {t.specializations.length === 0 ? <span className="text-muted">—</span> : isSpecialist(t.specializations, s.name) ? <Badge tone="good">In specialisation</Badge> : <Badge tone="warn">Outside</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </>
  );
}

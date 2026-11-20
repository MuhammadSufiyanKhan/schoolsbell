import Link from "next/link";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { formatPkMobile, telHref, isSpecialist } from "@/lib/pk";
import { Badge, Empty, PageHeader, Table } from "@/components/ui";

export default async function TeachersPage() {
  const me = await requireUser(["admin"]);
  const teachers = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.schoolId, me.schoolId), eq(schema.users.role, "teacher")))
    .orderBy(schema.users.name);
  const ids = teachers.map((t) => t.id);

  const [subjects, ownClasses] = ids.length
    ? await Promise.all([
        db
          .select({ id: schema.subjects.id, name: schema.subjects.name, teacherId: schema.subjects.teacherId, cls: schema.classes.name, section: schema.classes.section })
          .from(schema.subjects)
          .innerJoin(schema.classes, eq(schema.classes.id, schema.subjects.classId))
          .where(inArray(schema.subjects.teacherId, ids))
          .orderBy(schema.classes.name, schema.subjects.name),
        db.select().from(schema.classes).where(inArray(schema.classes.teacherId, ids)),
      ])
    : [[], []];

  return (
    <>
      <PageHeader
        title="Teachers"
        subtitle="Contact details, ID card, specialisations and teaching load for every teacher. Add or edit teachers under People."
        action={<Link href="/people" className="btn-ghost">Add a teacher</Link>}
      />
      {teachers.length === 0 ? (
        <Empty>No teachers yet. Add one under People.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className="th">Teacher</th>
              <th className="th">Mobile</th>
              <th className="th">ID card (CNIC)</th>
              <th className="th">Specialised in</th>
              <th className="th">Teaching</th>
              <th className="th">Class teacher of</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border align-top">
            {teachers.map((t) => {
              const mine = subjects.filter((s) => s.teacherId === t.id);
              const homeroom = ownClasses.filter((c) => c.teacherId === t.id);
              return (
                <tr key={t.id}>
                  <td className="td">
                    <p className="font-medium">{t.name}</p>
                    <p className="break-all text-xs text-muted">{t.email}</p>
                    <Link href={`/teachers/${t.id}`} className="mt-1 inline-block text-xs text-brand hover:underline">View details</Link>
                  </td>
                  <td className="td whitespace-nowrap">
                    {t.phone ? <a href={telHref(t.phone)} className="hover:underline">{formatPkMobile(t.phone)}</a> : <span className="text-muted">—</span>}
                  </td>
                  <td className="td whitespace-nowrap tabular-nums">{t.cnic ?? <span className="text-muted">—</span>}</td>
                  <td className="td">
                    {t.specializations.length === 0 ? <span className="text-muted">—</span> : (
                      <div className="flex flex-wrap gap-1">{t.specializations.map((s) => <Badge key={s} tone="brand">{s}</Badge>)}</div>
                    )}
                  </td>
                  <td className="td">
                    {mine.length === 0 ? <span className="text-muted">Not assigned</span> : (
                      <ul className="space-y-0.5">
                        {mine.map((s) => (
                          <li key={s.id} className="whitespace-nowrap">
                            <Link href={`/courses/${s.id}`} className="hover:underline">{s.name}</Link>
                            <span className="text-xs text-muted"> · {s.cls}-{s.section}</span>
                            {t.specializations.length > 0 && !isSpecialist(t.specializations, s.name) && <span title="Outside their listed specialisations" className="ml-1 text-xs text-warn">●</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="td">{homeroom.length === 0 ? <span className="text-muted">—</span> : homeroom.map((c) => `${c.name}-${c.section}`).join(", ")}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <p className="mt-3 max-w-3xl text-xs text-muted">
        <span className="text-warn">●</span> marks a subject outside the teacher&apos;s listed specialisations. It&apos;s only a hint; you decide who teaches what under Classes.
      </p>
    </>
  );
}

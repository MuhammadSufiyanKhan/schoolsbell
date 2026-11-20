import { count, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { visibleClasses } from "@/lib/scope";
import { Empty, PageHeader } from "@/components/ui";

export default async function ClassesPage() {
  const user = await requireUser(["admin", "teacher"]);
  const classes = await visibleClasses(user);
  const ids = classes.map((c) => c.id);
  const [counts, subjects, teachers] = ids.length
    ? await Promise.all([
        db.select({ classId: schema.students.classId, n: count() }).from(schema.students).where(inArray(schema.students.classId, ids)).groupBy(schema.students.classId),
        db.select({ classId: schema.subjects.classId, name: schema.subjects.name, teacher: schema.users.name })
          .from(schema.subjects).leftJoin(schema.users, eq(schema.users.id, schema.subjects.teacherId)).where(inArray(schema.subjects.classId, ids)),
        db.select().from(schema.users).where(eq(schema.users.schoolId, user.schoolId)),
      ])
    : [[], [], []];
  const tName = new Map(teachers.map((t) => [t.id, t.name]));

  return (
    <>
      <PageHeader title="Classes" subtitle="Sections, class teachers and subject teachers." />
      {classes.length === 0 ? (
        <Empty>No classes assigned to you yet.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <article key={c.id} className="card">
              <h2 className="text-lg font-semibold">{c.name} – {c.section}</h2>
              <p className="text-sm text-muted">Class teacher: {c.teacherId ? tName.get(c.teacherId) : "—"}</p>
              <p className="mt-3 text-2xl font-semibold tabular-nums">{counts.find((x) => x.classId === c.id)?.n ?? 0} <span className="text-sm font-normal text-muted">students</span></p>
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                {subjects.filter((s) => s.classId === c.id).map((s) => (
                  <li key={s.name} className="flex justify-between"><span>{s.name}</span><span className="text-muted">{s.teacher}</span></li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

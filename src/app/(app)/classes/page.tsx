import { and, count, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { visibleClasses } from "@/lib/scope";
import { Empty, PageHeader } from "@/components/ui";
import { isSpecialist } from "@/lib/pk";
import { addSubject, assignSubjectTeacher, createClass, setClassTeacher } from "./actions";

type Teacher = { id: number; name: string; specializations: string[] };

/**
 * Teacher dropdown. When a subject name is known, teachers specialised in it are listed first with a ★;
 * every option shows the teacher's specialisations so the principal can choose at a glance.
 */
function TeacherSelect({ teachers, value, name = "teacherId", label, subjectName }: { teachers: Teacher[]; value?: number | null; name?: string; label: string; subjectName?: string }) {
  const specialists = subjectName ? teachers.filter((t) => isSpecialist(t.specializations, subjectName)) : [];
  const others = teachers.filter((t) => !specialists.includes(t));
  const opt = (t: Teacher, star: boolean) => (
    <option key={t.id} value={t.id}>
      {star ? "★ " : ""}{t.name}{t.specializations.length ? ` — ${t.specializations.join(", ")}` : ""}
    </option>
  );
  return (
    <select name={name} defaultValue={value ?? ""} className="input !w-auto !max-w-[16rem] !py-1 text-xs" aria-label={label}>
      <option value="">— unassigned —</option>
      {specialists.map((t) => opt(t, true))}
      {others.map((t) => opt(t, false))}
    </select>
  );
}

export default async function ClassesPage() {
  const user = await requireUser(["admin", "teacher"]);
  const isAdmin = user.role === "admin";
  const classes = await visibleClasses(user);
  const ids = classes.map((c) => c.id);
  const [counts, subjects, teachers] = await Promise.all([
    ids.length ? db.select({ classId: schema.students.classId, n: count() }).from(schema.students).where(inArray(schema.students.classId, ids)).groupBy(schema.students.classId) : [],
    ids.length ? db.select().from(schema.subjects).where(inArray(schema.subjects.classId, ids)).orderBy(schema.subjects.name) : [],
    db.select({ id: schema.users.id, name: schema.users.name, specializations: schema.users.specializations }).from(schema.users).where(and(eq(schema.users.schoolId, user.schoolId), eq(schema.users.role, "teacher"))).orderBy(schema.users.name),
  ]);
  const tName = new Map(teachers.map((t) => [t.id, t.name]));

  return (
    <>
      <PageHeader title="Classes" subtitle={isAdmin ? "Create classes, add subjects and assign teachers." : "Sections, class teachers and subject teachers."} />

      {isAdmin && (
        <section className="card mb-8 max-w-2xl">
          <h2 className="mb-3 text-sm font-semibold">New class</h2>
          <form action={createClass} className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2"><label className="label" htmlFor="c-name">Name</label><input id="c-name" name="name" required placeholder="Grade 9" className="input" /></div>
            <div><label className="label" htmlFor="c-section">Section</label><input id="c-section" name="section" required placeholder="A" className="input" /></div>
            <div>
              <label className="label" htmlFor="c-teacher">Class teacher</label>
              <select id="c-teacher" name="teacherId" className="input" defaultValue="">
                <option value="">— none —</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.specializations.length ? ` — ${t.specializations.join(", ")}` : ""}</option>)}
              </select>
            </div>
            <div className="sm:col-span-4"><button className="btn">Create class</button></div>
          </form>
          {teachers.length === 0 && <p className="mt-3 text-xs text-muted">No teachers yet. Add them under People first, then assign them here.</p>}
        </section>
      )}

      {classes.length === 0 ? (
        <Empty>{isAdmin ? "No classes yet. Create your first class above." : "No classes assigned to you yet."}</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {classes.map((c) => (
            <article key={c.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold"><Link href={`/classes/${c.id}`} className="hover:underline">{c.name} – {c.section}</Link></h2>
                  <p className="text-sm text-muted">{counts.find((x) => x.classId === c.id)?.n ?? 0} students</p>
                </div>
                <Link href={`/classes/${c.id}`} className="btn-ghost !py-1 text-xs" data-testid={`view-class-${c.id}`}>View students</Link>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">Class teacher:</span>
                {isAdmin ? (
                  <form action={setClassTeacher} className="flex items-center gap-2">
                    <input type="hidden" name="classId" value={c.id} />
                    <TeacherSelect teachers={teachers} value={c.teacherId} label={`Class teacher for ${c.name}-${c.section}`} />
                    <button className="btn-ghost !py-1 text-xs">Save</button>
                  </form>
                ) : (
                  <span>{c.teacherId ? tName.get(c.teacherId) : "—"}</span>
                )}
              </div>

              <ul className="mt-3 divide-y divide-border border-t border-border text-sm">
                {subjects.filter((s) => s.classId === c.id).map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-medium">{s.name}</span>
                    {isAdmin ? (
                      <form action={assignSubjectTeacher} className="flex items-center gap-2">
                        <input type="hidden" name="subjectId" value={s.id} />
                        <TeacherSelect teachers={teachers} value={s.teacherId} label={`Teacher for ${s.name}`} subjectName={s.name} />
                        <button className="btn-ghost !py-1 text-xs">Assign</button>
                      </form>
                    ) : (
                      <span className="text-muted">{s.teacherId ? tName.get(s.teacherId) : "—"}</span>
                    )}
                  </li>
                ))}
                {subjects.every((s) => s.classId !== c.id) && <li className="py-2 text-muted">No subjects yet.</li>}
              </ul>

              {isAdmin && (
                <form action={addSubject} className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
                  <input type="hidden" name="classId" value={c.id} />
                  <div className="min-w-32 flex-1">
                    <label className="label" htmlFor={`s-${c.id}`}>Add subject</label>
                    <input id={`s-${c.id}`} name="name" required placeholder="e.g. Physics" className="input" />
                  </div>
                  <TeacherSelect teachers={teachers} label={`Teacher for the new subject in ${c.name}-${c.section}`} />
                  <button className="btn !py-2">Add</button>
                </form>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

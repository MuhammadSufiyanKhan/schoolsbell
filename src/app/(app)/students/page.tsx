import Link from "next/link";
import { requireUser } from "@/lib/session";
import { visibleStudents, visibleClasses } from "@/lib/scope";
import { attendanceRates, gradeAverages, letter } from "@/lib/analytics";
import { Badge, Empty, PageHeader, Table } from "@/components/ui";
import { addStudent } from "./actions";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string }>;
}) {
  const user = await requireUser(["admin", "teacher"]);
  const { q = "", class: classFilter } = await searchParams;
  const [all, classes] = await Promise.all([visibleStudents(user), visibleClasses(user)]);
  const classById = new Map(classes.map((c) => [c.id, c]));
  const list = all.filter(
    (s) =>
      (!q || s.name.toLowerCase().includes(q.toLowerCase()) || s.rollNo.toLowerCase().includes(q.toLowerCase())) &&
      (!classFilter || String(s.classId) === classFilter),
  );
  const ids = list.map((s) => s.id);
  const [att, grades] = await Promise.all([attendanceRates(ids), gradeAverages(ids)]);

  return (
    <>
      <PageHeader title="Students" subtitle={`${list.length} of ${all.length} students`} />

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search name or roll no…" className="input max-w-xs" aria-label="Search students" />
        <select name="class" defaultValue={classFilter ?? ""} className="input max-w-[180px]" aria-label="Filter by class">
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}-{c.section}</option>
          ))}
        </select>
        <button className="btn-ghost">Filter</button>
      </form>

      {list.length === 0 ? (
        <Empty>No students match.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th className="th">Roll no</th><th className="th">Name</th><th className="th">Class</th>
              <th className="th">Attendance</th><th className="th">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((s) => {
              const a = att.get(s.id)?.rate ?? null;
              const g = grades.get(s.id) ?? null;
              const c = s.classId ? classById.get(s.classId) : null;
              return (
                <tr key={s.id} className="hover:bg-brand-soft/40">
                  <td className="td text-muted">{s.rollNo}</td>
                  <td className="td font-medium"><Link className="hover:underline" href={`/students/${s.id}`}>{s.name}</Link></td>
                  <td className="td">{c ? `${c.name}-${c.section}` : "–"}</td>
                  <td className="td"><Badge tone={a == null ? "neutral" : a >= 90 ? "good" : a >= 85 ? "warn" : "bad"}>{a ?? "–"}%</Badge></td>
                  <td className="td">{g ?? "–"}% <span className="text-muted">({letter(g)})</span></td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {user.role === "admin" && (
        <section className="card mt-8 max-w-xl">
          <h2 className="mb-4 text-sm font-semibold">Enrol a new student</h2>
          <form action={addStudent} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="name">Full name</label>
              <input id="name" name="name" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="rollNo">Roll no</label>
              <input id="rollNo" name="rollNo" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="classId">Class</label>
              <select id="classId" name="classId" required className="input">
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}-{c.section}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="dob">Date of birth</label>
              <input id="dob" name="dob" type="date" className="input" />
            </div>
            <div className="flex items-end"><button className="btn w-full">Add student</button></div>
          </form>
        </section>
      )}
    </>
  );
}

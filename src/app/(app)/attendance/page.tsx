import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { visibleClasses, visibleStudents } from "@/lib/scope";
import { attendanceRates, today } from "@/lib/analytics";
import { Badge, Empty, PageHeader, Table } from "@/components/ui";
import { saveAttendance } from "./actions";

const STATUSES = ["present", "absent", "late", "excused"] as const;

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; date?: string; saved?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  if (user.role === "student" || user.role === "parent") {
    const kids = await visibleStudents(user);
    const ids = kids.map((k) => k.id);
    const [rates, rows] = await Promise.all([
      attendanceRates(ids),
      ids.length
        ? db.select().from(schema.attendance).where(inArray(schema.attendance.studentId, ids)).orderBy(desc(schema.attendance.date)).limit(40)
        : [],
    ]);
    return (
      <>
        <PageHeader title="Attendance" subtitle="Last 28 days at a glance, with the most recent records." />
        <div className="mb-6 flex flex-wrap gap-3">
          {kids.map((k) => (
            <div key={k.id} className="card min-w-48">
              <p className="text-sm font-medium">{k.name}</p>
              <p className="text-3xl font-semibold tabular-nums">{rates.get(k.id)?.rate ?? "–"}%</p>
              <p className="text-xs text-muted">{rates.get(k.id)?.absent ?? 0} absences</p>
            </div>
          ))}
        </div>
        {rows.length === 0 ? <Empty>No records yet.</Empty> : (
          <Table>
            <thead><tr><th className="th">Date</th><th className="th">Student</th><th className="th">Status</th></tr></thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td">{r.date}</td>
                  <td className="td">{kids.find((k) => k.id === r.studentId)?.name}</td>
                  <td className="td"><Badge tone={r.status === "present" ? "good" : r.status === "absent" ? "bad" : "warn"}>{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </>
    );
  }

  const classes = await visibleClasses(user);
  const classId = Number(sp.class ?? classes[0]?.id);
  const date = sp.date ?? today();
  const cls = classes.find((c) => c.id === classId);
  const roster = (await visibleStudents(user)).filter((s) => s.classId === classId);
  const existing = roster.length
    ? await db.select().from(schema.attendance).where(and(eq(schema.attendance.date, date), inArray(schema.attendance.studentId, roster.map((s) => s.id))))
    : [];
  const current = new Map(existing.map((e) => [e.studentId, e.status]));

  return (
    <>
      <PageHeader title="Attendance" subtitle="Mark the register in under 30 seconds. Everyone defaults to present." />
      <form className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="class">Class</label>
          <select id="class" name="class" defaultValue={classId} className="input">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}-{c.section}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="date">Date</label>
          <input id="date" name="date" type="date" defaultValue={date} max={today()} className="input" />
        </div>
        <button className="btn-ghost">Load</button>
      </form>

      {sp.saved && <p role="status" className="mb-4 rounded-lg bg-good-soft px-4 py-2 text-sm text-good">Attendance saved for {date}.</p>}

      {!cls || roster.length === 0 ? <Empty>No students in this class.</Empty> : (
        <form action={saveAttendance}>
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="date" value={date} />
          <Table>
            <thead><tr><th className="th">Student</th>{STATUSES.map((s) => <th key={s} className="th capitalize">{s}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {roster.map((s) => (
                <tr key={s.id}>
                  <td className="td font-medium">{s.name} <span className="text-xs font-normal text-muted">{s.rollNo}</span></td>
                  {STATUSES.map((st) => (
                    <td key={st} className="td">
                      <input type="radio" name={`s_${s.id}`} value={st} defaultChecked={(current.get(s.id) ?? "present") === st} aria-label={`${s.name}: ${st}`} className="size-4 accent-[var(--brand)]" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
          <button className="btn mt-4">Save attendance</button>
        </form>
      )}
    </>
  );
}

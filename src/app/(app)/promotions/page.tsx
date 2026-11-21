import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { Empty, PageHeader } from "@/components/ui";
import { nextGradeName, sortClasses, suggestTarget } from "@/lib/promotion";
import { PromotionForm } from "./promotion-form";
import { undoLastPromotion } from "./actions";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const n = (v: string | string[] | undefined) => {
  const x = Number(one(v));
  return Number.isFinite(x) && x >= 0 && x < 100000 ? x : 0;
};

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(["admin"]);
  const sp = await searchParams;

  const [classRows, students, [last]] = await Promise.all([
    db.select({ id: schema.classes.id, name: schema.classes.name, section: schema.classes.section }).from(schema.classes).where(eq(schema.classes.schoolId, user.schoolId)),
    db.select({ id: schema.students.id, name: schema.students.name, rollNo: schema.students.rollNo, classId: schema.students.classId }).from(schema.students).where(eq(schema.students.schoolId, user.schoolId)).orderBy(schema.students.rollNo),
    db.select({ id: schema.auditLog.id, createdAt: schema.auditLog.createdAt, detail: schema.auditLog.detail }).from(schema.auditLog).where(and(eq(schema.auditLog.schoolId, user.schoolId), eq(schema.auditLog.action, "students.promote"))).orderBy(desc(schema.auditLog.id)).limit(1),
  ]);

  const sorted = sortClasses(classRows);
  const label = (c: { name: string; section: string }) => `${c.name} – ${c.section}`;
  const classes = sorted.map((c) => {
    const existing = suggestTarget(c, sorted);
    const nextName = nextGradeName(c.name);
    const wantsNew = !existing && nextName && !sorted.some((x) => x.name === nextName && x.section === c.section);
    return { c, existing, nextName, wantsNew };
  }).map(({ c, existing, nextName, wantsNew }) => ({
    id: c.id,
    label: label(c),
    // Existing next-grade class if there is one; otherwise offer to create it, so "Grade 1" always has somewhere to go.
    suggested: existing ? String(existing.id) : wantsNew ? "new" : "",
    newLabel: wantsNew && nextName ? `${nextName} – ${c.section}` : null,
    students: students.filter((s) => s.classId === c.id).map((s) => ({ id: s.id, name: s.name, rollNo: s.rollNo })),
  }));

  let lastCount = 0;
  try {
    lastCount = last?.detail ? (JSON.parse(last.detail).moves as unknown[]).length : 0;
  } catch {}

  const result = one(sp.result);
  const banner =
    result === "done" ? { ok: true, text: `Promoted ${n(sp.moved)} student${n(sp.moved) === 1 ? "" : "s"}.${n(sp.created) ? ` Created ${n(sp.created)} new class${n(sp.created) === 1 ? "" : "es"} for them.` : ""}${n(sp.stale) ? ` ${n(sp.stale)} were skipped because their class had changed in the meantime.` : ""}` }
    : result === "none" ? { ok: false, text: "Nothing to promote: choose where each class goes, and leave at least one student ticked." }
    : result === "undone" ? { ok: true, text: `Undone: ${n(sp.moved)} student${n(sp.moved) === 1 ? "" : "s"} moved back.${n(sp.skipped) ? ` ${n(sp.skipped)} were left alone because they had been moved since.` : ""}` }
    : result === "nothing-to-undo" ? { ok: false, text: "There is no promotion to undo." }
    : null;

  return (
    <>
      <PageHeader title="Promotions" subtitle="Move students up to the next grade in one go. Untick the students who did not pass and they stay where they are." />

      {banner && (
        <p role="status" className={`mb-5 rounded-lg px-4 py-3 text-sm ${banner.ok ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`} data-testid="promo-banner">{banner.text}</p>
      )}

      {last && lastCount > 0 && (
        <form action={undoLastPromotion} className="card mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span>
            Last promotion: <b>{lastCount}</b> student{lastCount === 1 ? "" : "s"} moved on {last.createdAt.toLocaleDateString("en-GB")}. Made a mistake?
          </span>
          <button className="btn-ghost" data-testid="promo-undo">Undo last promotion</button>
        </form>
      )}

      {classes.length === 0 ? (
        <Empty>No classes yet. Create classes first, then come back at the end of the year.</Empty>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">
            Each class is pre-set to move to the next grade in the same section (Grade 1 – A → Grade 2 – A). If that class doesn&apos;t exist yet, it is created for you. Change it, or choose &ldquo;Don&apos;t move&rdquo;.
            Attendance, grades and fees stay with each student. Subjects belong to a class, so students see their new class&apos;s courses.
          </p>
          <PromotionForm classes={classes} targets={classes.map((c) => ({ id: c.id, label: c.label }))} />
        </>
      )}
    </>
  );
}

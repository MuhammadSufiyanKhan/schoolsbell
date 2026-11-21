"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { planMoves, type Move } from "@/lib/promotion";

const MAX_MOVES = 5000;

/** Move the chosen students to their class's target. Students left unticked (e.g. failed) are not touched. */
export async function promoteStudents(form: FormData) {
  const user = await requireUser(["admin"]);
  const promote = form.getAll("promote").filter((v): v is string => typeof v === "string").slice(0, MAX_MOVES);
  const targets: Record<number, string> = {};
  for (const [k, v] of form) {
    const m = /^to_(\d{1,9})$/.exec(k);
    if (m && typeof v === "string") targets[Number(m[1])] = v;
  }
  const planned = planMoves(promote, targets);
  if (!planned.length) redirect("/promotions?result=none");

  // Everything below is checked against the database, never trusted from the form.
  const classRows = await db.select({ id: schema.classes.id }).from(schema.classes).where(eq(schema.classes.schoolId, user.schoolId));
  const classIds = new Set(classRows.map((c) => c.id));
  const students = await db
    .select({ id: schema.students.id, classId: schema.students.classId })
    .from(schema.students)
    .where(and(eq(schema.students.schoolId, user.schoolId), inArray(schema.students.id, planned.map((m) => m.studentId))));
  const current = new Map(students.map((s) => [s.id, s.classId]));

  const moves: Move[] = [];
  let stale = 0;
  for (const m of planned) {
    const ok = current.get(m.studentId) === m.from && classIds.has(m.from) && (m.to === null || classIds.has(m.to));
    if (ok) moves.push(m);
    else stale++;
  }

  if (moves.length) {
    // (The production driver has no transactions.) The record goes first: if an update fails part-way the record still
    // exists, and "undo" only reverts students who are actually where it says they were moved to.
    await db.insert(schema.auditLog).values({
      schoolId: user.schoolId,
      userId: user.id,
      action: "students.promote",
      detail: JSON.stringify({ moves: moves.map((m) => [m.studentId, m.from, m.to]) }),
    });
    // One UPDATE per destination class.
    const byTarget = new Map<number | null, number[]>();
    for (const m of moves) byTarget.set(m.to, [...(byTarget.get(m.to) ?? []), m.studentId]);
    for (const [to, ids] of byTarget) {
      await db.update(schema.students).set({ classId: to }).where(and(eq(schema.students.schoolId, user.schoolId), inArray(schema.students.id, ids)));
    }
  }
  revalidatePath("/promotions");
  revalidatePath("/students");
  revalidatePath("/classes");
  revalidatePath("/dashboard");
  redirect(`/promotions?result=done&moved=${moves.length}&stale=${stale}`);
}

/** Undo the most recent promotion, but only for students who are still where that promotion put them. */
export async function undoLastPromotion() {
  const user = await requireUser(["admin"]);
  const [last] = await db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.schoolId, user.schoolId), eq(schema.auditLog.action, "students.promote")))
    .orderBy(desc(schema.auditLog.id))
    .limit(1);
  if (!last?.detail) redirect("/promotions?result=nothing-to-undo");

  let moves: Move[] = [];
  try {
    moves = (JSON.parse(last.detail).moves as [number, number, number | null][]).map(([studentId, from, to]) => ({ studentId, from, to }));
  } catch {
    redirect("/promotions?result=nothing-to-undo");
  }
  const ids = moves.map((m) => m.studentId);
  const now = ids.length ? await db.select({ id: schema.students.id, classId: schema.students.classId }).from(schema.students).where(and(eq(schema.students.schoolId, user.schoolId), inArray(schema.students.id, ids))) : [];
  const where = new Map(now.map((s) => [s.id, s.classId]));
  const revert = moves.filter((m) => where.get(m.studentId) === m.to);

  const byFrom = new Map<number, number[]>();
  for (const m of revert) byFrom.set(m.from, [...(byFrom.get(m.from) ?? []), m.studentId]);
  for (const [from, sids] of byFrom) {
    await db.update(schema.students).set({ classId: from }).where(and(eq(schema.students.schoolId, user.schoolId), inArray(schema.students.id, sids)));
  }
  // Mark that batch as undone so it can't be undone twice and the one before it becomes the latest.
  await db.update(schema.auditLog).set({ action: "students.promote.undone" }).where(eq(schema.auditLog.id, last.id));
  await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "students.promote.undo", detail: `reverted ${revert.length} of ${moves.length}` });
  revalidatePath("/promotions");
  revalidatePath("/students");
  revalidatePath("/classes");
  redirect(`/promotions?result=undone&moved=${revert.length}&skipped=${moves.length - revert.length}`);
}

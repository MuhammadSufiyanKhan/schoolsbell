import "server-only";
import { and, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

export const AT_RISK_ATTENDANCE = 85; // % — below this a student is flagged
export const AT_RISK_GRADE = 50; // % — below this a student is flagged

export function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const today = () => new Date().toISOString().slice(0, 10);

/** Attendance % per student over the last `days` days (late counts as present, excused is ignored). */
export async function attendanceRates(studentIds: number[], days = 28) {
  const out = new Map<number, { rate: number | null; absent: number; total: number }>();
  if (!studentIds.length) return out;
  const rows = await db
    .select()
    .from(schema.attendance)
    .where(and(inArray(schema.attendance.studentId, studentIds), gte(schema.attendance.date, isoDaysAgo(days))));
  for (const id of studentIds) out.set(id, { rate: null, absent: 0, total: 0 });
  for (const r of rows) {
    if (r.status === "excused") continue;
    const o = out.get(r.studentId)!;
    o.total++;
    if (r.status === "absent") o.absent++;
  }
  for (const o of out.values()) o.rate = o.total ? Math.round(((o.total - o.absent) / o.total) * 100) : null;
  return out;
}

/** Weighted grade average (%) per student across all subjects. */
export async function gradeAverages(studentIds: number[]) {
  const out = new Map<number, number | null>();
  if (!studentIds.length) return out;
  const rows = await db
    .select({
      studentId: schema.grades.studentId,
      score: schema.grades.score,
      max: schema.assessments.maxScore,
      weight: schema.assessments.weight,
    })
    .from(schema.grades)
    .innerJoin(schema.assessments, eq(schema.assessments.id, schema.grades.assessmentId))
    .where(inArray(schema.grades.studentId, studentIds));
  const acc = new Map<number, { num: number; den: number }>();
  for (const r of rows) {
    const a = acc.get(r.studentId) ?? { num: 0, den: 0 };
    a.num += (r.score / r.max) * r.weight;
    a.den += r.weight;
    acc.set(r.studentId, a);
  }
  for (const id of studentIds) {
    const a = acc.get(id);
    out.set(id, a && a.den ? Math.round((a.num / a.den) * 100) : null);
  }
  return out;
}

export function letter(pct: number | null) {
  if (pct == null) return "–";
  if (pct >= 90) return "A";
  if (pct >= 80) return "B";
  if (pct >= 70) return "C";
  if (pct >= 60) return "D";
  return "F";
}

/** Transparent rule-based early-warning (no black box): attendance + grades. */
export function riskReasons(att: number | null, grade: number | null) {
  const reasons: string[] = [];
  if (att != null && att < AT_RISK_ATTENDANCE) reasons.push(`attendance ${att}%`);
  if (grade != null && grade < AT_RISK_GRADE) reasons.push(`grades ${grade}%`);
  return reasons;
}

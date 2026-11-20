"use server";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser, type SessionUser } from "@/lib/session";
import { visibleStudents } from "@/lib/scope";

/** Teachers may only touch subjects they teach; admins any subject in their school. */
async function assertSubjectAccess(user: SessionUser, subjectId: number) {
  const [subject] = await db.select().from(schema.subjects).where(and(eq(schema.subjects.id, subjectId), eq(schema.subjects.schoolId, user.schoolId))).limit(1);
  if (!subject || (user.role === "teacher" && subject.teacherId !== user.id)) throw new Error("Not allowed");
  return subject;
}

export async function saveGrades(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const assessmentId = z.coerce.number().int().parse(form.get("assessmentId"));
  const subjectId = z.coerce.number().int().parse(form.get("subjectId"));
  const subject = await assertSubjectAccess(user, subjectId);
  const [assessment] = await db.select().from(schema.assessments).where(and(eq(schema.assessments.id, assessmentId), eq(schema.assessments.subjectId, subjectId))).limit(1);
  if (!assessment) throw new Error("Assessment not found");

  const roster = (await visibleStudents(user)).filter((s) => s.classId === subject.classId);
  const values = roster.flatMap((s) => {
    const raw = form.get(`g_${s.id}`);
    if (raw === null || raw === "") return [];
    const score = Number(raw);
    if (!Number.isFinite(score) || score < 0 || score > assessment.maxScore) return [];
    return [{ assessmentId, studentId: s.id, score }];
  });
  if (values.length) {
    await db.insert(schema.grades).values(values).onConflictDoUpdate({
      target: [schema.grades.assessmentId, schema.grades.studentId],
      set: { score: sql`excluded.score` },
    });
    await db.insert(schema.auditLog).values({
      schoolId: user.schoolId,
      userId: user.id,
      action: "grades.save",
      detail: `assessment ${assessmentId}: ${values.length} scores`,
    });
  }
  redirect(`/grades?subject=${subjectId}&assessment=${assessmentId}&saved=1`);
}

const NewAssessment = z.object({
  subjectId: z.coerce.number().int(),
  title: z.string().trim().min(1).max(100),
  maxScore: z.coerce.number().positive(),
  weight: z.coerce.number().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function addAssessment(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const data = NewAssessment.parse(Object.fromEntries(form));
  await assertSubjectAccess(user, data.subjectId);
  const [created] = await db.insert(schema.assessments).values(data).returning();
  redirect(`/grades?subject=${data.subjectId}&assessment=${created.id}`);
}

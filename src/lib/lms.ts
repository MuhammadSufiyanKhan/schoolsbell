import "server-only";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { SessionUser } from "./session";

export type CourseAccess = {
  subject: typeof schema.subjects.$inferSelect;
  cls: typeof schema.classes.$inferSelect;
  /** manage = admin or the subject's teacher; learn = a student in the subject's class */
  mode: "manage" | "learn";
  student?: typeof schema.students.$inferSelect;
};

/**
 * THE authorization rule for everything in the LMS.
 * - must be the same school
 * - admin: manage anything; teacher: manage only subjects they teach;
 * - student: learn only subjects of their own class; parents: no access.
 */
export async function getCourseAccess(user: SessionUser, subjectId: number): Promise<CourseAccess | null> {
  if (!Number.isInteger(subjectId)) return null;
  const [row] = await db
    .select({ subject: schema.subjects, cls: schema.classes })
    .from(schema.subjects)
    .innerJoin(schema.classes, eq(schema.classes.id, schema.subjects.classId))
    .where(and(eq(schema.subjects.id, subjectId), eq(schema.subjects.schoolId, user.schoolId)))
    .limit(1);
  if (!row) return null;
  if (user.role === "admin") return { ...row, mode: "manage" };
  if (user.role === "teacher" && row.subject.teacherId === user.id) return { ...row, mode: "manage" };
  if (user.role === "student") {
    const [st] = await db
      .select()
      .from(schema.students)
      .where(and(eq(schema.students.userId, user.id), eq(schema.students.classId, row.subject.classId)))
      .limit(1);
    if (st) return { ...row, mode: "learn", student: st };
  }
  return null;
}

/** For pages: 404 (not 403) so the existence of other schools' data isn't revealed. */
export async function requireCourse(user: SessionUser, subjectId: number, mode?: "manage") {
  const access = await getCourseAccess(user, subjectId);
  if (!access || (mode === "manage" && access.mode !== "manage")) notFound();
  return access;
}

/** For server actions. */
export async function requireCourseForAction(user: SessionUser, subjectId: number, mode: "manage" | "any" = "manage") {
  const access = await getCourseAccess(user, subjectId);
  if (!access || (mode === "manage" && access.mode !== "manage")) throw new Error("Not allowed");
  return access;
}

export { createAssessment, syncGrade } from "./gradebook";
export { clampScore } from "./scoring";

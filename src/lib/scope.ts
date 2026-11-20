import "server-only";
import { eq, inArray, or } from "drizzle-orm";
import { db, schema } from "@/db";
import type { SessionUser } from "./session";

/** Students whose data the signed-in user may see. */
export async function visibleStudents(user: SessionUser) {
  const { students, classes } = schema;
  if (user.role === "admin") {
    return db.select().from(students).where(eq(students.schoolId, user.schoolId)).orderBy(students.rollNo);
  }
  if (user.role === "teacher") {
    const mine = await db.select({ id: classes.id }).from(classes).where(eq(classes.teacherId, user.id));
    const bySubject = await db.select({ id: schema.subjects.classId }).from(schema.subjects).where(eq(schema.subjects.teacherId, user.id));
    const ids = [...new Set([...mine, ...bySubject].map((c) => c.id))];
    if (!ids.length) return [];
    return db.select().from(students).where(inArray(students.classId, ids)).orderBy(students.rollNo);
  }
  return db
    .select()
    .from(students)
    .where(or(eq(students.userId, user.id), eq(students.guardianId, user.id)))
    .orderBy(students.rollNo);
}

export async function visibleClasses(user: SessionUser) {
  const { classes, subjects } = schema;
  if (user.role === "admin") return db.select().from(classes).where(eq(classes.schoolId, user.schoolId)).orderBy(classes.name);
  if (user.role === "teacher") {
    const bySubject = await db.select({ id: subjects.classId }).from(subjects).where(eq(subjects.teacherId, user.id));
    const own = await db.select({ id: classes.id }).from(classes).where(eq(classes.teacherId, user.id));
    const ids = [...new Set([...bySubject, ...own].map((c) => c.id))];
    if (!ids.length) return [];
    return db.select().from(classes).where(inArray(classes.id, ids)).orderBy(classes.name);
  }
  return [];
}

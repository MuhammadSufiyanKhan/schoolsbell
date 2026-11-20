"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

const optId = z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined));

/** A teacher id is only valid if that teacher belongs to the caller's school. */
async function assertTeacher(schoolId: number, teacherId: number | undefined) {
  if (!teacherId) return null;
  const [t] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.id, teacherId), eq(schema.users.schoolId, schoolId), eq(schema.users.role, "teacher")))
    .limit(1);
  if (!t) throw new Error("Teacher not found");
  return t.id;
}

async function assertClass(schoolId: number, classId: number) {
  const [c] = await db.select().from(schema.classes).where(and(eq(schema.classes.id, classId), eq(schema.classes.schoolId, schoolId))).limit(1);
  if (!c) throw new Error("Class not found");
  return c;
}

export async function createClass(form: FormData) {
  const user = await requireUser(["admin"]);
  const d = z
    .object({ name: z.string().trim().min(1).max(60), section: z.string().trim().min(1).max(20), teacherId: optId })
    .parse(Object.fromEntries(form));
  const teacherId = await assertTeacher(user.schoolId, d.teacherId);
  await db.insert(schema.classes).values({ schoolId: user.schoolId, name: d.name, section: d.section, teacherId });
  await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "class.create", detail: `${d.name}-${d.section}` });
  revalidatePath("/classes");
}

export async function setClassTeacher(form: FormData) {
  const user = await requireUser(["admin"]);
  const d = z.object({ classId: z.coerce.number().int(), teacherId: optId }).parse(Object.fromEntries(form));
  await assertClass(user.schoolId, d.classId);
  const teacherId = await assertTeacher(user.schoolId, d.teacherId);
  await db.update(schema.classes).set({ teacherId }).where(eq(schema.classes.id, d.classId));
  await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "class.teacher", detail: `class ${d.classId} -> ${teacherId ?? "none"}` });
  revalidatePath("/classes");
}

export async function addSubject(form: FormData) {
  const user = await requireUser(["admin"]);
  const d = z.object({ classId: z.coerce.number().int(), name: z.string().trim().min(1).max(80), teacherId: optId }).parse(Object.fromEntries(form));
  await assertClass(user.schoolId, d.classId);
  const teacherId = await assertTeacher(user.schoolId, d.teacherId);
  await db.insert(schema.subjects).values({ schoolId: user.schoolId, classId: d.classId, name: d.name, teacherId });
  await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "subject.create", detail: `${d.name} in class ${d.classId}` });
  revalidatePath("/classes");
}

export async function assignSubjectTeacher(form: FormData) {
  const user = await requireUser(["admin"]);
  const d = z.object({ subjectId: z.coerce.number().int(), teacherId: optId }).parse(Object.fromEntries(form));
  const [subject] = await db.select().from(schema.subjects).where(and(eq(schema.subjects.id, d.subjectId), eq(schema.subjects.schoolId, user.schoolId))).limit(1);
  if (!subject) throw new Error("Subject not found");
  const teacherId = await assertTeacher(user.schoolId, d.teacherId);
  await db.update(schema.subjects).set({ teacherId }).where(eq(schema.subjects.id, d.subjectId));
  await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "subject.teacher", detail: `subject ${d.subjectId} -> ${teacherId ?? "none"}` });
  revalidatePath("/classes");
  revalidatePath("/courses");
}

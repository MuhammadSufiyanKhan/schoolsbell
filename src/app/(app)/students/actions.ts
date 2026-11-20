"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { parseGuardian } from "@/lib/profile";
import { ensureParentAccount, type ParentLogin } from "@/lib/parents";

export type EnrolState = { error?: string; ok?: string; parent?: ParentLogin; values?: Record<string, string>; at?: number } | undefined;

const Input = z.object({
  name: z.string().trim().min(2, "Enter the student's name.").max(120),
  rollNo: z.string().trim().min(1, "Enter a roll number.").max(30),
  classId: z.coerce.number().int().positive("Choose a class."),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
});

export async function addStudent(_prev: EnrolState, form: FormData): Promise<EnrolState> {
  const user = await requireUser(["admin"]);
  const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const fail = (error: string): EnrolState => ({ error, values, at: Date.now() });

  const parsed = Input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const guardian = parseGuardian((k) => form.get(k));
  if (!guardian.ok) return fail(guardian.error);
  const data = parsed.data;

  // The class must belong to this school.
  const [cls] = await db.select().from(schema.classes).where(and(eq(schema.classes.id, data.classId), eq(schema.classes.schoolId, user.schoolId))).limit(1);
  if (!cls) return fail("Class not found.");
  const [dupe] = await db.select({ id: schema.students.id }).from(schema.students).where(and(eq(schema.students.schoolId, user.schoolId), eq(schema.students.classId, cls.id), eq(schema.students.rollNo, data.rollNo))).limit(1);
  if (dupe) return fail(`Roll number ${data.rollNo} is already used in ${cls.name}-${cls.section}.`);

  const [student] = await db.insert(schema.students).values({ schoolId: user.schoolId, name: data.name, rollNo: data.rollNo, classId: cls.id, dob: data.dob ?? null, ...guardian.value }).returning();
  await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "student.create", detail: `${data.name} (${data.rollNo})` });

  // A guardian mobile number automatically gives the guardian (parent) a login.
  let parent: ParentLogin | undefined;
  if (guardian.value.guardianPhone || guardian.value.guardianName) {
    parent = await ensureParentAccount(user.schoolId, { id: student.id, name: student.name, guardianId: null }, { name: guardian.value.guardianName, phone: guardian.value.guardianPhone });
    if (parent.kind === "created") {
      await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "parent.auto_create", detail: `for student ${student.id}` });
    }
  }
  revalidatePath("/students");
  revalidatePath("/parents");
  return { ok: `${data.name} was enrolled in ${cls.name}-${cls.section}.`, parent, at: Date.now() };
}

"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { generatePassword } from "@/lib/passwords";
import { parseGuardian, parseStaff } from "@/lib/profile";

export type CredState =
  | {
      error?: string;
      created?: { name: string; email: string; role: string; password: string };
      /** What the user typed, returned on error so the form isn't wiped. */
      values?: Record<string, string>;
      at?: number;
    }
  | undefined;

const Create = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["admin", "teacher", "student", "parent"]),
  classId: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  rollNo: z.string().trim().max(30).optional(),
  studentId: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
});

export async function createUser(_prev: CredState, form: FormData): Promise<CredState> {
  const me = await requireUser(["admin"]);
  const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const fail = (error: string): CredState => ({ error, values, at: Date.now() });
  const parsed = Create.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;

  // Only the principal (owner) may create other administrators.
  if (d.role === "admin" && !me.isOwner) return fail("Only the principal can create administrators.");

  // Role-specific profile details (validated before anything is written).
  const get = (k: string) => form.get(k);
  let staff: { phone: string | null; cnic: string | null; specializations: string[] } | undefined;
  let guardian: { guardianName: string | null; guardianPhone: string | null; guardianCnic: string | null } | undefined;
  if (d.role === "teacher" || d.role === "admin") {
    const r = parseStaff(get);
    if (!r.ok) return fail(r.error);
    staff = r.value;
    if (staff.cnic) {
      const [dupe] = await db.select({ id: schema.users.id }).from(schema.users).where(and(eq(schema.users.schoolId, me.schoolId), eq(schema.users.cnic, staff.cnic))).limit(1);
      if (dupe) return fail("Another staff member already has this ID card number.");
    }
  }
  if (d.role === "student") {
    const r = parseGuardian(get);
    if (!r.ok) return fail(r.error);
    guardian = r.value;
  }

  const [dupe] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, d.email)).limit(1);
  if (dupe) return fail("That email is already in use.");

  // Validate related records belong to THIS school before writing anything.
  let classId: number | undefined;
  if (d.role === "student") {
    if (!d.classId) return fail("Choose a class for the student.");
    if (!d.rollNo) return fail("Enter a roll number for the student.");
    const [c] = await db.select().from(schema.classes).where(and(eq(schema.classes.id, d.classId), eq(schema.classes.schoolId, me.schoolId))).limit(1);
    if (!c) return fail("Class not found.");
    classId = c.id;
  }
  let linkStudent: number | undefined;
  if (d.role === "parent" && d.studentId) {
    const [s] = await db.select().from(schema.students).where(and(eq(schema.students.id, d.studentId), eq(schema.students.schoolId, me.schoolId))).limit(1);
    if (!s) return fail("Student not found.");
    linkStudent = s.id;
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const [u] = await db.insert(schema.users).values({ schoolId: me.schoolId, name: d.name, email: d.email, passwordHash, role: d.role, ...(staff ?? {}) }).returning();

  if (d.role === "student") {
    await db.insert(schema.students).values({ schoolId: me.schoolId, userId: u.id, classId: classId!, name: d.name, rollNo: d.rollNo!, ...(guardian ?? {}) });
  }
  if (linkStudent) {
    await db.update(schema.students).set({ guardianId: u.id }).where(and(eq(schema.students.id, linkStudent), eq(schema.students.schoolId, me.schoolId)));
  }
  await db.insert(schema.auditLog).values({ schoolId: me.schoolId, userId: me.id, action: "user.create", detail: `${d.role}: ${d.email}` });

  revalidatePath("/people");
  revalidatePath("/students");
  // The one-time password is returned to this browser only, never stored in plain text or logged.
  return { created: { name: d.name, email: d.email, role: d.role, password }, at: Date.now() };
}

export async function changeRole(form: FormData) {
  const me = await requireUser(["admin"]);
  const id = z.coerce.number().int().parse(form.get("id"));
  const role = z.enum(["admin", "teacher"]).parse(form.get("role"));
  if (!me.isOwner) throw new Error("Only the principal can change roles.");
  if (id === me.id) throw new Error("You can't change your own role.");

  const [target] = await db.select().from(schema.users).where(and(eq(schema.users.id, id), eq(schema.users.schoolId, me.schoolId))).limit(1);
  if (!target || target.isOwner) throw new Error("Not allowed");
  // Students and parents are linked to student records, so their role is fixed.
  if (target.role !== "admin" && target.role !== "teacher") throw new Error("Only teachers and admins can be changed.");

  await db.update(schema.users).set({ role }).where(eq(schema.users.id, id));
  await db.insert(schema.auditLog).values({ schoolId: me.schoolId, userId: me.id, action: "user.role", detail: `${target.email}: ${target.role} -> ${role}` });
  revalidatePath("/people");
}

export async function resetPassword(_prev: CredState, form: FormData): Promise<CredState> {
  const me = await requireUser(["admin"]);
  const id = z.coerce.number().int().parse(form.get("id"));
  const [target] = await db.select().from(schema.users).where(and(eq(schema.users.id, id), eq(schema.users.schoolId, me.schoolId))).limit(1);
  if (!target) return { error: "User not found." };
  if (target.isOwner) return { error: "The principal's password can only be changed from their own account." };
  if (target.role === "admin" && !me.isOwner) return { error: "Only the principal can reset an administrator's password." };

  const password = generatePassword();
  await db.update(schema.users).set({ passwordHash: await bcrypt.hash(password, 10) }).where(eq(schema.users.id, id));
  await db.insert(schema.auditLog).values({ schoolId: me.schoolId, userId: me.id, action: "user.password_reset", detail: target.email });
  return { created: { name: target.name, email: target.email, role: target.role, password } };
}

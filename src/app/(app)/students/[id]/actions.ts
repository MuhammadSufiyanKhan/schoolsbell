"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { parseGuardian } from "@/lib/profile";

export type GuardianState = { error?: string; ok?: boolean; values?: Record<string, string>; at?: number } | undefined;

/** Admin-only: guardian contact details include the guardian's CNIC. */
export async function updateGuardian(_prev: GuardianState, form: FormData): Promise<GuardianState> {
  const me = await requireUser(["admin"]);
  const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const id = z.coerce.number().int().safeParse(form.get("id"));
  if (!id.success) return { error: "Student not found.", values, at: Date.now() };
  const parsed = parseGuardian((k) => form.get(k));
  if (!parsed.ok) return { error: parsed.error, values, at: Date.now() };

  const updated = await db
    .update(schema.students)
    .set(parsed.value)
    .where(and(eq(schema.students.id, id.data), eq(schema.students.schoolId, me.schoolId)))
    .returning();
  if (!updated.length) return { error: "Student not found.", values, at: Date.now() };
  // Audit the fact of the change, not the sensitive values.
  await db.insert(schema.auditLog).values({ schoolId: me.schoolId, userId: me.id, action: "student.guardian_update", detail: `student ${id.data}` });
  revalidatePath(`/students/${id.data}`);
  revalidatePath("/students");
  return { ok: true, at: Date.now() };
}

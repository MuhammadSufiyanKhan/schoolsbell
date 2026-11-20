"use server";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { canEditStaff } from "@/lib/permissions";
import { parseStaff } from "@/lib/profile";

export type StaffState = { error?: string; ok?: boolean; values?: Record<string, string>; at?: number } | undefined;

export async function updateStaff(_prev: StaffState, form: FormData): Promise<StaffState> {
  const me = await requireUser(["admin"]);
  const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const fail = (error: string): StaffState => ({ error, values, at: Date.now() });

  const parsedId = z.coerce.number().int().safeParse(form.get("id"));
  const name = z.string().trim().min(2, "Enter a name.").max(120).safeParse(form.get("name"));
  if (!parsedId.success) return fail("User not found.");
  if (!name.success) return fail(name.error.issues[0].message);

  const [target] = await db.select().from(schema.users).where(and(eq(schema.users.id, parsedId.data), eq(schema.users.schoolId, me.schoolId))).limit(1);
  if (!target || !canEditStaff(me, target)) return fail("You can't edit this person.");
  if (target.role === "student" || target.role === "parent") return fail("Student and parent details are edited from the student's page.");

  const staff = parseStaff((k) => form.get(k));
  if (!staff.ok) return fail(staff.error);
  if (staff.value.cnic) {
    const [dupe] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.schoolId, me.schoolId), eq(schema.users.cnic, staff.value.cnic), ne(schema.users.id, target.id)))
      .limit(1);
    if (dupe) return fail("Another staff member already has this ID card number.");
  }

  await db.update(schema.users).set({ name: name.data, ...staff.value }).where(eq(schema.users.id, target.id));
  // Log which fields changed, never their values (CNIC/phone are sensitive).
  const changed = (["phone", "cnic"] as const).filter((k) => (target[k] ?? null) !== staff.value[k]);
  if (JSON.stringify(target.specializations) !== JSON.stringify(staff.value.specializations)) changed.push("specializations" as never);
  await db.insert(schema.auditLog).values({ schoolId: me.schoolId, userId: me.id, action: "staff.update", detail: `${target.email}: ${changed.join(", ") || "no profile changes"}` });
  revalidatePath("/people");
  revalidatePath(`/people/${target.id}`);
  revalidatePath("/classes");
  return { ok: true, at: Date.now() };
}

"use server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

export type PwState = { error?: string; ok?: boolean } | undefined;

const Input = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string().min(8, "New password must be at least 8 characters.").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "New passwords don't match.", path: ["confirm"] });

export async function changePassword(_prev: PwState, form: FormData): Promise<PwState> {
  const user = await requireUser();
  const parsed = Input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
  if (!row || !(await bcrypt.compare(parsed.data.current, row.passwordHash))) return { error: "Current password is incorrect." };
  if (parsed.data.next === parsed.data.current) return { error: "Choose a password different from the current one." };

  // Once the owner picks their own password, the administrator-viewable initial one is erased.
  await db.update(schema.users).set({ passwordHash: await bcrypt.hash(parsed.data.next, 10), initialPasswordEnc: null }).where(eq(schema.users.id, user.id));
  await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "user.password_change" });
  return { ok: true };
}

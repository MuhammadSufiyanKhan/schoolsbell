"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession } from "@/lib/session";

const Input = z
  .object({
    schoolName: z.string().trim().min(2, "Enter your school's name.").max(120),
    name: z.string().trim().min(2, "Enter your name.").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters.").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match.", path: ["confirm"] });

export type RegisterState = { error?: string; values?: { schoolName: string; name: string; email: string }; at?: number } | undefined;

export async function registerSchool(_prev: RegisterState, form: FormData): Promise<RegisterState> {
  // Honeypot: real users never see or fill this field; bots usually do.
  if (form.get("website")) redirect("/login");

  // On any error we hand back what they typed (never passwords) so the form isn't wiped.
  const values = { schoolName: String(form.get("schoolName") ?? ""), name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  const parsed = Input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values, at: Date.now() };
  const { schoolName, name, email, password } = parsed.data;

  const [existing] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existing) return { error: "An account with this email already exists. Try signing in.", values, at: Date.now() };

  const passwordHash = await bcrypt.hash(password, 10);
  const [school] = await db.insert(schema.schools).values({ name: schoolName }).returning();
  let userId: number;
  try {
    const [user] = await db
      .insert(schema.users)
      .values({ schoolId: school.id, name, email, passwordHash, role: "admin", isOwner: true })
      .returning();
    userId = user.id;
  } catch {
    // e.g. two sign-ups racing on the same email: don't leave an orphan school behind.
    await db.delete(schema.schools).where(eq(schema.schools.id, school.id));
    return { error: "Couldn't create the account. Please try again.", values, at: Date.now() };
  }
  await db.insert(schema.auditLog).values({ schoolId: school.id, userId, action: "school.register", detail: schoolName });

  await createSession(userId);
  redirect("/dashboard?welcome=1");
}

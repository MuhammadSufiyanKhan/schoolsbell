"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession, destroySession } from "@/lib/session";

const Input = z.object({ email: z.string().email(), password: z.string().min(1) });

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export type LoginState = { error?: string; email?: string; at?: number } | undefined;

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const typedEmail = String(form.get("email") ?? "").slice(0, 255);
  const parsed = Input.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter a valid email and password.", email: typedEmail, at: Date.now() };
  const [u] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, parsed.data.email.toLowerCase()))
    .limit(1);
  const ok = await bcrypt.compare(parsed.data.password, u?.passwordHash ?? DUMMY_HASH);
  if (!u || !ok) return { error: "Incorrect email or password.", email: typedEmail, at: Date.now() };
  await createSession(u.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

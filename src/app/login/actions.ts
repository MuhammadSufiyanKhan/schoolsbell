"use server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, schema } from "@/db";
import { createSession, destroySession } from "@/lib/session";
import { parsePkMobile } from "@/lib/pk";

const Input = z.object({ identifier: z.string().trim().min(3).max(255), password: z.string().min(1).max(200) });

// Compared against when no account matches, so response time doesn't reveal which logins exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export type LoginState = { error?: string; email?: string; at?: number } | undefined;

const BAD = "Incorrect email/mobile number or password.";

/**
 * Sign in with an email address, or (for parents) the mobile number registered as the guardian's contact.
 * A mobile number only ever resolves to PARENT accounts: staff numbers aren't verified or unique.
 */
export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const typed = String(form.get("email") ?? "").slice(0, 255);
  const fail = (error: string): LoginState => ({ error, email: typed, at: Date.now() });

  const parsed = Input.safeParse({ identifier: form.get("email"), password: form.get("password") });
  if (!parsed.success) return fail("Enter your email or mobile number, and your password.");
  const { identifier, password } = parsed.data;

  let candidates: (typeof schema.users.$inferSelect)[];
  if (identifier.includes("@")) {
    candidates = await db.select().from(schema.users).where(eq(schema.users.email, identifier.toLowerCase())).limit(1);
  } else {
    const phone = parsePkMobile(identifier);
    if (!phone.ok || !phone.value) return fail("Enter a valid email address or Pakistani mobile number (e.g. 0300-1234567).");
    // The same mobile can be a parent in more than one school; the password decides which account it is.
    candidates = await db.select().from(schema.users).where(and(eq(schema.users.phone, phone.value), eq(schema.users.role, "parent"))).limit(5);
  }

  let user: (typeof candidates)[number] | undefined;
  if (candidates.length === 0) {
    await bcrypt.compare(password, DUMMY_HASH);
  } else {
    for (const c of candidates) {
      if (await bcrypt.compare(password, c.passwordHash)) {
        user = c;
        break;
      }
    }
  }
  if (!user) return fail(BAD);
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

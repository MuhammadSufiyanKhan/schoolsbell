import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Role } from "./roles";

const COOKIE = "sb_session";
const MAX_AGE = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return new TextEncoder().encode(s ?? "dev-only-insecure-secret-change-me-please-32b");
}

export type SessionUser = {
  id: number;
  schoolId: number;
  name: string;
  email: string;
  role: Role;
};

export async function createSession(userId: number) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, Number(payload.uid))).limit(1);
    if (!u) return null;
    return { id: u.id, schoolId: u.schoolId, name: u.name, email: u.email, role: u.role };
  } catch {
    return null;
  }
}

/** Use in server components/actions: redirects to /login when signed out, or to /dashboard when role not allowed. */
export async function requireUser(allowed?: Role[]): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (allowed && !allowed.includes(user.role)) redirect("/dashboard");
  return user;
}

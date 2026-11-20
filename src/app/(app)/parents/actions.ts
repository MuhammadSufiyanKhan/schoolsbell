"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { decryptSecret } from "@/lib/secrets";
import { generatePassword } from "@/lib/passwords";
import { setParentPassword } from "@/lib/parents";
import { formatPkMobile } from "@/lib/pk";

export type RevealState = { error?: string; login?: string; password?: string } | undefined;

async function loadParent(schoolId: number, raw: FormDataEntryValue | null) {
  const id = z.coerce.number().int().safeParse(raw);
  if (!id.success) return null;
  const [p] = await db.select().from(schema.users).where(and(eq(schema.users.id, id.data), eq(schema.users.schoolId, schoolId), eq(schema.users.role, "parent"))).limit(1);
  return p ?? null;
}

const loginOf = (p: { phone: string | null; email: string }) => (p.phone ? formatPkMobile(p.phone) : p.email);

/**
 * Show a parent's initial password to an administrator. Only possible while the parent has not yet changed it
 * (the stored copy is erased at that moment). Every reveal is audit-logged.
 */
export async function revealParentPassword(_prev: RevealState, form: FormData): Promise<RevealState> {
  const me = await requireUser(["admin"]);
  const parent = await loadParent(me.schoolId, form.get("id"));
  if (!parent) return { error: "Parent not found." };
  const password = decryptSecret(parent.initialPasswordEnc);
  if (!password) return { error: "Not available: the parent has changed their password, or it can't be recovered. Reset it to issue a new one." };
  await db.insert(schema.auditLog).values({ schoolId: me.schoolId, userId: me.id, action: "parent.credentials_view", detail: `parent ${parent.id}` });
  return { login: loginOf(parent), password };
}

export async function resetParentPassword(_prev: RevealState, form: FormData): Promise<RevealState> {
  const me = await requireUser(["admin"]);
  const parent = await loadParent(me.schoolId, form.get("id"));
  if (!parent) return { error: "Parent not found." };
  const password = generatePassword();
  await setParentPassword(parent.id, password);
  await db.insert(schema.auditLog).values({ schoolId: me.schoolId, userId: me.id, action: "parent.password_reset", detail: `parent ${parent.id}` });
  revalidatePath("/parents");
  return { login: loginOf(parent), password };
}

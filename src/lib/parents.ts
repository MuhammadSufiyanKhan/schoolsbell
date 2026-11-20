import "server-only";
import { and, count, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { generatePassword } from "./passwords";
import { encryptSecret } from "./secrets";
import { formatPkMobile } from "./pk";

export type { ParentLogin } from "./parent-types";
import type { ParentLogin } from "./parent-types";

/**
 * Parents log in with their mobile number, but `users.email` is mandatory and globally unique, so an
 * auto-created parent gets an internal placeholder address on the reserved `.invalid` TLD (RFC 2606:
 * guaranteed never to be a real mailbox). It is scoped by school, so the same mobile can exist in two schools.
 */
export const PARENT_EMAIL_DOMAIN = "phone.invalid";
export const parentEmail = (schoolId: number, phone: string) => `p${schoolId}-${phone.replace(/\D/g, "")}@${PARENT_EMAIL_DOMAIN}`;
export const isAutoParentEmail = (email: string) => email.endsWith(`@${PARENT_EMAIL_DOMAIN}`);

type StudentRef = { id: number; name: string; guardianId: number | null };

/**
 * Called whenever a student's guardian details are saved. With a guardian mobile number it makes sure a
 * parent login exists and is linked to the student:
 *  - a parent with this mobile already exists in the school (e.g. a sibling)  → link to it, no new password
 *  - else, the student's current auto-created parent has no other children    → correct its mobile in place
 *  - else                                                                     → create a new account
 * Without a mobile number nothing is created (there would be no login id).
 */
export async function ensureParentAccount(
  schoolId: number,
  student: StudentRef,
  guardian: { name: string | null; phone: string | null },
): Promise<ParentLogin> {
  const phone = guardian.phone;
  if (!phone) return { kind: "none" };
  const shown = formatPkMobile(phone);

  const findByPhone = async () => {
    const [p] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.schoolId, schoolId), eq(schema.users.role, "parent"), eq(schema.users.phone, phone)))
      .limit(1);
    return p;
  };
  const link = (parentId: number) =>
    db.update(schema.students).set({ guardianId: parentId }).where(and(eq(schema.students.id, student.id), eq(schema.students.schoolId, schoolId)));

  const existing = await findByPhone();
  if (existing) {
    const alreadyLinked = student.guardianId === existing.id;
    if (!alreadyLinked) await link(existing.id);
    return { kind: "linked", name: existing.name, phone: shown, alreadyLinked };
  }

  // The guardian's number was corrected: move the existing auto-created account instead of orphaning it.
  if (student.guardianId) {
    const [old] = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.id, student.guardianId), eq(schema.users.schoolId, schoolId), eq(schema.users.role, "parent")))
      .limit(1);
    if (old && old.phone && isAutoParentEmail(old.email)) {
      const [{ n }] = await db.select({ n: count() }).from(schema.students).where(eq(schema.students.guardianId, old.id));
      if (n <= 1) {
        const name = guardian.name ?? old.name;
        await db.update(schema.users).set({ phone, email: parentEmail(schoolId, phone), name }).where(eq(schema.users.id, old.id));
        return { kind: "updated", name, phone: shown };
      }
    }
  }

  const password = generatePassword();
  const name = guardian.name ?? `Parent of ${student.name}`;
  try {
    const [created] = await db
      .insert(schema.users)
      .values({
        schoolId,
        name,
        email: parentEmail(schoolId, phone),
        passwordHash: await bcrypt.hash(password, 10),
        role: "parent",
        phone,
        initialPasswordEnc: encryptSecret(password),
      })
      .returning();
    await link(created.id);
    return { kind: "created", name, phone: shown, password };
  } catch (e) {
    // Two requests creating the same parent at once: the database's unique index let only one win.
    const winner = await findByPhone();
    if (!winner) throw e;
    await link(winner.id);
    return { kind: "linked", name: winner.name, phone: shown, alreadyLinked: false };
  }
}

/** Set a new password on a parent account and keep it viewable by administrators until the parent changes it. */
export async function setParentPassword(userId: number, password: string) {
  await db
    .update(schema.users)
    .set({ passwordHash: await bcrypt.hash(password, 10), initialPasswordEnc: encryptSecret(password) })
    .where(eq(schema.users.id, userId));
}

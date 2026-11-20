"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";

export async function markPaid(form: FormData) {
  const user = await requireUser(["admin"]);
  const id = z.coerce.number().int().parse(form.get("id"));
  const updated = await db
    .update(schema.invoices)
    .set({ paidAt: new Date() })
    .where(and(eq(schema.invoices.id, id), eq(schema.invoices.schoolId, user.schoolId)))
    .returning();
  if (updated.length) {
    await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "invoice.paid", detail: `invoice ${id}` });
  }
  revalidatePath("/fees");
}

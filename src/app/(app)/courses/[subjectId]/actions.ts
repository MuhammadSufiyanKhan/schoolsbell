"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { createAssessment, requireCourseForAction } from "@/lib/lms";
import { aiErrorMessage, generateTest } from "@/lib/ai";

const subjectId = z.coerce.number().int();

/** Only http(s) links: blocks javascript:/data: URLs that would run script when clicked. */
const httpUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Links must start with http:// or https://");

export async function addMaterial(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const parsed = z
    .object({
      subjectId,
      title: z.string().trim().min(1).max(150),
      body: z.string().trim().max(10000).optional(),
      url: httpUrl.optional().or(z.literal("").transform(() => undefined)),
    })
    .safeParse(Object.fromEntries(form));
  const sid = Number(form.get("subjectId"));
  await requireCourseForAction(user, sid);
  // Bad input is shown as a message on the page, not a crash.
  if (!parsed.success) {
    const bad = parsed.error.issues[0]?.path[0] === "url" ? "bad_url" : "bad_material";
    redirect(`/courses/${sid}?error=${bad}`);
  }
  const d = parsed.data;
  if (!d.body && !d.url) redirect(`/courses/${sid}?error=bad_material`);
  await db.insert(schema.materials).values({ schoolId: user.schoolId, subjectId: d.subjectId, authorId: user.id, title: d.title, body: d.body || null, url: d.url ?? null });
  revalidatePath(`/courses/${d.subjectId}`);
}

export async function deleteMaterial(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const d = z.object({ subjectId, id: z.coerce.number().int() }).parse(Object.fromEntries(form));
  await requireCourseForAction(user, d.subjectId);
  await db.delete(schema.materials).where(and(eq(schema.materials.id, d.id), eq(schema.materials.subjectId, d.subjectId)));
  revalidatePath(`/courses/${d.subjectId}`);
}

export async function addAssignment(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const d = z
    .object({
      subjectId,
      title: z.string().trim().min(1).max(150),
      instructions: z.string().trim().min(1).max(10000),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      maxScore: z.coerce.number().positive().max(1000),
    })
    .parse(Object.fromEntries(form));
  await requireCourseForAction(user, d.subjectId);
  // Each assignment reports into the gradebook, so averages and dashboards include it automatically.
  const assessmentId = await createAssessment(d.subjectId, d.title, d.maxScore);
  const [a] = await db
    .insert(schema.assignments)
    .values({ schoolId: user.schoolId, subjectId: d.subjectId, assessmentId, title: d.title, instructions: d.instructions, dueDate: d.dueDate, maxScore: d.maxScore })
    .returning();
  redirect(`/courses/${d.subjectId}/assignments/${a.id}`);
}

export async function createBlankTest(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const d = z.object({ subjectId, title: z.string().trim().min(1).max(150) }).parse(Object.fromEntries(form));
  await requireCourseForAction(user, d.subjectId);
  const [t] = await db.insert(schema.tests).values({ schoolId: user.schoolId, subjectId: d.subjectId, title: d.title }).returning();
  redirect(`/courses/${d.subjectId}/tests/${t.id}`);
}

export type AiTestState = { error?: string } | undefined;

export async function generateAiTest(_prev: AiTestState, form: FormData): Promise<AiTestState> {
  const user = await requireUser(["admin", "teacher"]);
  const parsed = z
    .object({
      subjectId,
      topic: z.string().trim().min(2, "Enter a topic.").max(200),
      count: z.coerce.number().int().min(3).max(20),
      mcqShare: z.enum(["all_mcq", "mixed", "all_short"]),
      difficulty: z.enum(["easy", "medium", "hard"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const { subject, cls } = await requireCourseForAction(user, d.subjectId);

  let testId: number;
  try {
    const gen = await generateTest({ subject: subject.name, grade: cls.name, topic: d.topic, count: d.count, mcqShare: d.mcqShare, difficulty: d.difficulty });
    if (!gen.questions.length) return { error: "The AI didn't return usable questions. Please try again." };
    const [t] = await db
      .insert(schema.tests)
      .values({ schoolId: user.schoolId, subjectId: d.subjectId, title: gen.title, instructions: gen.instructions || null, aiGenerated: true })
      .returning();
    await db.insert(schema.testQuestions).values(gen.questions.map((q, i) => ({ testId: t.id, position: i, ...q })));
    await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "test.ai_generate", detail: `test ${t.id}: ${gen.questions.length} questions` });
    testId = t.id;
  } catch (e) {
    return { error: aiErrorMessage(e) };
  }
  // Created as an unpublished draft: the teacher must review before students can see it.
  redirect(`/courses/${d.subjectId}/tests/${testId}`);
}

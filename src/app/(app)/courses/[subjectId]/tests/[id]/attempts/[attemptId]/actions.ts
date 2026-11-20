"use server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { requireCourseForAction } from "@/lib/lms";
import { aiErrorCode } from "@/lib/ai";
import { aiGradeAttempts, releaseAttempt } from "@/lib/tests";

const ids = z.object({ subjectId: z.coerce.number().int(), testId: z.coerce.number().int(), attemptId: z.coerce.number().int() });

async function load(user: Awaited<ReturnType<typeof requireUser>>, raw: unknown) {
  const d = ids.parse(raw);
  await requireCourseForAction(user, d.subjectId);
  const [test] = await db.select().from(schema.tests).where(and(eq(schema.tests.id, d.testId), eq(schema.tests.subjectId, d.subjectId))).limit(1);
  if (!test) throw new Error("Test not found");
  const [attempt] = await db.select().from(schema.testAttempts).where(and(eq(schema.testAttempts.id, d.attemptId), eq(schema.testAttempts.testId, d.testId))).limit(1);
  if (!attempt) throw new Error("Attempt not found");
  return { d, test, attempt, url: `/courses/${d.subjectId}/tests/${d.testId}/attempts/${d.attemptId}` };
}

export async function aiGradeOne(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const { d, url } = await load(user, Object.fromEntries(form));
  let result: string;
  try {
    const n = await aiGradeAttempts(d.testId, [d.attemptId]);
    await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "test.ai_grade", detail: `attempt ${d.attemptId}: ${n} answers` });
    result = n ? "?aigraded=1" : "?error=ai_empty";
  } catch (e) {
    result = `?error=${aiErrorCode(e)}`;
  }
  redirect(url + result);
}

/** The human gate: nothing reaches the student or the gradebook until the teacher releases it. */
export async function releaseMarks(form: FormData) {
  const user = await requireUser(["admin", "teacher"]);
  const { d, attempt, url } = await load(user, Object.fromEntries(form));

  const answers = await db.select().from(schema.testAnswers).where(eq(schema.testAnswers.attemptId, attempt.id));
  const questions = await db.select().from(schema.testQuestions).where(eq(schema.testQuestions.testId, d.testId));
  const qById = new Map(questions.map((q) => [q.id, q]));

  for (const a of answers) {
    const q = qById.get(a.questionId);
    if (!q) continue;
    const rawScore = form.get(`score_${a.id}`);
    if (rawScore === null || rawScore === "") redirect(url + "?error=unmarked");
    const score = Number(rawScore);
    if (!Number.isFinite(score) || score < 0 || score > q.points) redirect(url + "?error=bad_score");
    const feedback = String(form.get(`fb_${a.id}`) ?? "").trim().slice(0, 600);
    await db.update(schema.testAnswers).set({ score, feedback: feedback || null }).where(eq(schema.testAnswers.id, a.id));
  }
  await releaseAttempt(attempt.id);
  await db.insert(schema.auditLog).values({ schoolId: user.schoolId, userId: user.id, action: "test.release", detail: `attempt ${attempt.id}` });
  redirect(`/courses/${d.subjectId}/tests/${d.testId}?saved=1`);
}

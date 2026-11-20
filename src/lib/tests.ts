import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import type { LanguageModel } from "ai";
import { gradeAnswers, type GradeItem } from "./ai";
import { syncGrade } from "./gradebook";

type Question = typeof schema.testQuestions.$inferSelect;

export const sumPoints = (qs: Pick<Question, "points">[]) => qs.reduce((s, q) => s + q.points, 0);

/** Instant, deterministic marking for multiple choice. */
export function markMcq(q: Question, selectedIndex: number | null) {
  return selectedIndex != null && selectedIndex === q.correctIndex ? q.points : 0;
}

/** Recompute an attempt's total from its answer scores. */
export async function recomputeTotal(attemptId: number) {
  const answers = await db.select().from(schema.testAnswers).where(eq(schema.testAnswers.attemptId, attemptId));
  const total = answers.reduce((s, a) => s + (a.score ?? 0), 0);
  await db.update(schema.testAttempts).set({ totalScore: total }).where(eq(schema.testAttempts.id, attemptId));
  return total;
}

/** Release marks to the student and write them into the gradebook. */
export async function releaseAttempt(attemptId: number) {
  const [attempt] = await db.select().from(schema.testAttempts).where(eq(schema.testAttempts.id, attemptId)).limit(1);
  if (!attempt) return;
  const total = await recomputeTotal(attemptId);
  await db.update(schema.testAttempts).set({ status: "graded" }).where(eq(schema.testAttempts.id, attemptId));
  const [test] = await db.select().from(schema.tests).where(eq(schema.tests.id, attempt.testId)).limit(1);
  await syncGrade(test?.assessmentId ?? null, attempt.studentId, total);
}

/**
 * AI-grade every ungraded short answer in the given attempts (one model call per attempt).
 * Marks are SUGGESTIONS: attempts move to "ai_graded" and stay hidden from students until a teacher releases them.
 * Returns how many answers were graded.
 */
export async function aiGradeAttempts(testId: number, attemptIds: number[], model?: LanguageModel) {
  if (!attemptIds.length) return 0;
  const questions = await db.select().from(schema.testQuestions).where(eq(schema.testQuestions.testId, testId));
  const shortQs = new Map(questions.filter((q) => q.kind === "short").map((q) => [q.id, q]));
  if (!shortQs.size) return 0;

  let graded = 0;
  // Small batches keep us well inside the function time limit while still running in parallel.
  for (let i = 0; i < attemptIds.length; i += 4) {
    const batch = attemptIds.slice(i, i + 4);
    await Promise.all(
      batch.map(async (attemptId) => {
        const answers = await db
          .select()
          .from(schema.testAnswers)
          .where(and(eq(schema.testAnswers.attemptId, attemptId), inArray(schema.testAnswers.questionId, [...shortQs.keys()])));
        const pending = answers.filter((a) => a.score == null);
        if (!pending.length) return;

        const items: GradeItem[] = pending.map((a) => {
          const q = shortQs.get(a.questionId)!;
          return {
            id: a.id,
            question: q.prompt,
            reference: q.modelAnswer,
            maxPoints: q.points,
            // Blank answers need no model call, and get zero.
            answer: (a.answerText ?? "").slice(0, 4000),
          };
        });
        const blanks = items.filter((it) => !it.answer.trim());
        for (const b of blanks) {
          await db.update(schema.testAnswers).set({ score: 0, feedback: "No answer given.", aiGraded: true }).where(eq(schema.testAnswers.id, b.id));
          graded++;
        }
        const toGrade = items.filter((it) => it.answer.trim());
        const results = await gradeAnswers(toGrade, model);
        for (const [answerId, r] of results) {
          await db.update(schema.testAnswers).set({ score: r.score, feedback: r.feedback, aiGraded: true }).where(eq(schema.testAnswers.id, answerId));
          graded++;
        }
        // Only flag the attempt as AI-graded once nothing is left unmarked.
        const after = await db.select().from(schema.testAnswers).where(eq(schema.testAnswers.attemptId, attemptId));
        if (after.every((a) => a.score != null)) {
          await recomputeTotal(attemptId);
          await db.update(schema.testAttempts).set({ status: "ai_graded" }).where(and(eq(schema.testAttempts.id, attemptId), eq(schema.testAttempts.status, "submitted")));
        }
      }),
    );
  }
  return graded;
}

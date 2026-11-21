import { z } from "zod";

/** Limits shared by the generator (what the model may return) and the PDF endpoint (what the browser may send back). */
export const EXAM_LIMITS = { questions: 60, prompt: 1500, option: 300, answer: 3000, title: 200, instructions: 1000 } as const;

export const ExamQuestion = z.object({
  kind: z.enum(["mcq", "short", "long"]),
  prompt: z.string().trim().min(1).max(EXAM_LIMITS.prompt),
  options: z.array(z.string().trim().min(1).max(EXAM_LIMITS.option)).min(2).max(6).nullable(),
  correctIndex: z.number().int().min(0).nullable(),
  answer: z.string().trim().max(EXAM_LIMITS.answer).nullable(),
  marks: z.number().min(0.5).max(50),
});
export type ExamQuestion = z.infer<typeof ExamQuestion>;

export const Exam = z
  .object({
    title: z.string().trim().min(1).max(EXAM_LIMITS.title),
    instructions: z.string().trim().max(EXAM_LIMITS.instructions),
    questions: z.array(ExamQuestion).min(1).max(EXAM_LIMITS.questions),
  })
  .superRefine((exam, ctx) => {
    exam.questions.forEach((q, i) => {
      if (q.kind === "mcq" && (!q.options || q.correctIndex == null || q.correctIndex >= q.options.length)) {
        ctx.addIssue({ code: "custom", path: ["questions", i], message: "mcq needs options and a valid correctIndex" });
      }
    });
  });
export type Exam = z.infer<typeof Exam>;

/** Details printed in the paper's header. All optional text is length-capped; the school name comes from the session, not the browser. */
export const PaperMeta = z.object({
  subject: z.string().trim().max(80).default(""),
  grade: z.string().trim().max(40).default(""),
  duration: z.string().trim().max(40).default(""),
  date: z.string().trim().max(40).default(""),
});
export type PaperMeta = z.infer<typeof PaperMeta>;

export const PdfRequest = z.object({
  exam: Exam,
  meta: PaperMeta,
  variant: z.enum(["student", "teacher"]),
});

/** What the teacher asks for. Counts are per type; at least one question overall. */
export const ExamRequest = z
  .object({
    prompt: z.string().trim().max(2000).default(""),
    mcq: z.coerce.number().int().min(0).max(30).default(0),
    short: z.coerce.number().int().min(0).max(20).default(0),
    long: z.coerce.number().int().min(0).max(10).default(0),
    difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
    language: z.string().trim().min(2).max(40).default("English"),
    pages: z.string().trim().max(40).default(""),
  })
  .refine((r) => r.mcq + r.short + r.long >= 1, { message: "Ask for at least one question." })
  .refine((r) => r.mcq + r.short + r.long <= 40, { message: "At most 40 questions per paper." });
export type ExamRequest = z.infer<typeof ExamRequest>;

export const totalMarks = (exam: Exam) => exam.questions.reduce((sum, q) => sum + q.marks, 0);

import { z } from "zod";

/** Instructions for every AI Assistant draft. The answer is shown as a formatted document, so ask for Markdown. */
export const ASSISTANT_SYSTEM =
  "You are an assistant for school teachers. Produce practical, classroom-ready, age-appropriate output. " +
  "Be concise and never invent facts about real students. Everything you write is a DRAFT that the teacher will review. " +
  "Format the answer in clean Markdown: use ## headings, bullet lists, numbered steps and tables where they help. " +
  "Do not wrap the answer in a code block and do not add a chatty preamble such as 'Sure!' or 'Here is'.";

export type Tool = "lesson" | "quiz" | "comment" | "message";
export const TOOLS: readonly Tool[] = ["lesson", "quiz", "comment", "message"];

const Lesson = z.object({ grade: z.string().trim().min(1).max(40), subject: z.string().trim().min(1).max(60), topic: z.string().trim().min(1).max(200), minutes: z.coerce.number().int().min(10).max(180) });
const Quiz = z.object({ grade: z.string().trim().min(1).max(40), topic: z.string().trim().min(1).max(200), count: z.coerce.number().int().min(3).max(20), kind: z.enum(["multiple choice", "short answer", "mixed"]) });
export const CommentInput = z.object({ studentId: z.coerce.number().int(), tone: z.enum(["warm and encouraging", "formal", "constructive and direct"]) });
const Msg = z.object({ situation: z.string().trim().min(5).max(800), tone: z.enum(["friendly", "formal", "urgent but kind"]), language: z.string().trim().min(2).max(40) });

export type Built = { ok: true; prompt: string } | { ok: false; error: string };

/** Prompts for the tools that need no database lookup. */
export function buildPrompt(tool: "lesson" | "quiz" | "message", fields: Record<string, unknown>): Built {
  if (tool === "lesson") {
    const d = Lesson.safeParse(fields);
    if (!d.success) return { ok: false, error: "Please fill in every field." };
    return { ok: true, prompt: `Create a ${d.data.minutes}-minute lesson plan for ${d.data.grade} ${d.data.subject} on "${d.data.topic}". Include: learning objectives, materials, a timed activity sequence (hook, instruction, practice, check for understanding), differentiation for struggling and advanced learners, and a 3-question exit ticket.` };
  }
  if (tool === "quiz") {
    const d = Quiz.safeParse(fields);
    if (!d.success) return { ok: false, error: "Please fill in every field." };
    return { ok: true, prompt: `Write a ${d.data.count}-question ${d.data.kind} quiz for ${d.data.grade} on "${d.data.topic}". Order questions from easy to hard. After the quiz, give an answer key and, for short-answer questions, a brief marking rubric.` };
  }
  const d = Msg.safeParse(fields);
  if (!d.success) return { ok: false, error: "Describe the situation (at least a few words)." };
  return { ok: true, prompt: `Draft a short ${d.data.tone} message to a parent in ${d.data.language}. Situation: ${d.data.situation}. Do not include any student's full name; use [Student] as a placeholder. End with a clear next step.` };
}

/** Privacy: only the FIRST NAME and aggregate numbers are ever sent: no surname, roll number, date of birth or id. */
export function commentPrompt(firstName: string, tone: string, attendance: number | null | undefined, grade: number | null | undefined) {
  return `Write a ${tone} end-of-term report card comment (60-90 words) for ${firstName}. Facts: attendance over the last 4 weeks ${attendance ?? "unknown"}%; overall grade average ${grade ?? "unknown"}%. Mention one strength and one concrete next step. Do not invent anecdotes.`;
}

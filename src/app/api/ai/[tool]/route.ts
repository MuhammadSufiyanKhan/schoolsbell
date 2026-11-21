import { getUser } from "@/lib/session";
import { visibleStudents } from "@/lib/scope";
import { attendanceRates, gradeAverages } from "@/lib/analytics";
import { aiErrorMessage, classifyAiError, streamPlainText, type AiFailure } from "@/lib/ai";
import { ASSISTANT_SYSTEM, CommentInput, TOOLS, buildPrompt, commentPrompt, type Tool } from "@/lib/ai-tools";

// Teachers see the answer appear as it is written. The model also has hard time limits (see lib/ai.ts).
export const maxDuration = 180;
export const dynamic = "force-dynamic";

/** Record Separator: everything after it in the stream is a JSON error that happened AFTER text had started. */
const RS = "\u001e";

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const STATUS: Record<AiFailure, number> = { not_configured: 503, billing: 503, auth: 503, model: 503, rate_limit: 429, overloaded: 503, timeout: 504, empty: 502, unknown: 502 };

export async function POST(req: Request, { params }: { params: Promise<{ tool: string }> }) {
  // Cookies are SameSite=Lax (which already blocks cross-site POSTs); also refuse a mismatched Origin outright.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return json({ error: "Cross-site request blocked." }, 403);
    } catch {
      return json({ error: "Bad request." }, 400);
    }
  }

  const user = await getUser();
  if (!user) return json({ error: "Please sign in again." }, 401);
  if (user.role !== "admin" && user.role !== "teacher") return json({ error: "Only teachers and administrators can use the AI Assistant." }, 403);

  const { tool } = await params;
  if (!(TOOLS as readonly string[]).includes(tool)) return json({ error: "Unknown tool." }, 404);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const fields = Object.fromEntries(form);

  let prompt: string;
  if (tool === "comment") {
    const d = CommentInput.safeParse(fields);
    if (!d.success) return json({ error: "Please choose a student." }, 400);
    // Only students this user is allowed to see.
    const student = (await visibleStudents(user)).find((s) => s.id === d.data.studentId);
    if (!student) return json({ error: "Student not found." }, 404);
    const [att, grade] = await Promise.all([attendanceRates([student.id]), gradeAverages([student.id])]);
    prompt = commentPrompt(student.name.split(" ")[0], d.data.tone, att.get(student.id)?.rate, grade.get(student.id));
  } else {
    const built = buildPrompt(tool as Exclude<Tool, "comment">, fields);
    if (!built.ok) return json({ error: built.error }, 400);
    prompt = built.prompt;
  }

  const gen = streamPlainText(prompt, ASSISTANT_SYSTEM, { signal: req.signal });

  // Pull the first chunk BEFORE answering: a failure at this point (bad key, billing, retired model, no response
  // in time…) can still be reported with a proper HTTP status and message.
  let first: IteratorResult<string>;
  try {
    first = await gen.next();
  } catch (e) {
    return json({ error: aiErrorMessage(e), kind: classifyAiError(e) }, STATUS[classifyAiError(e)]);
  }

  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(enc.encode(first.value));
        if (!first.done) {
          for await (const chunk of gen) controller.enqueue(enc.encode(chunk));
        }
      } catch (e) {
        // Text has already started: keep it, and append the reason after a separator the page understands.
        controller.enqueue(enc.encode(RS + JSON.stringify({ error: aiErrorMessage(e) })));
      } finally {
        controller.close();
      }
    },
    cancel() {
      void gen.return(undefined);
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
  });
}

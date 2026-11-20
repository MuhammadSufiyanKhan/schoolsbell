"use client";
import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { generateAiTest } from "./actions";

export function AiTestForm({ subjectId }: { subjectId: number }) {
  const [state, action, pending] = useActionState(generateAiTest, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-6">
      <input type="hidden" name="subjectId" value={subjectId} />
      <div className="sm:col-span-6">
        <label className="label" htmlFor="ai-topic">Topic or chapter</label>
        <input id="ai-topic" name="topic" required placeholder="e.g. Photosynthesis and plant nutrition" className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="ai-count">Questions</label>
        <input id="ai-count" name="count" type="number" min={3} max={20} defaultValue={8} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="ai-mix">Question types</label>
        <select id="ai-mix" name="mcqShare" className="input" defaultValue="mixed">
          <option value="mixed">Mixed</option>
          <option value="all_mcq">Multiple choice only</option>
          <option value="all_short">Short answer only</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="ai-diff">Difficulty</label>
        <select id="ai-diff" name="difficulty" className="input" defaultValue="medium">
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>
      <div className="sm:col-span-6 flex flex-wrap items-center gap-3">
        <button className="btn" disabled={pending}>
          <Sparkles className="size-4" aria-hidden /> {pending ? "Writing your test… (10–30s)" : "Generate test with AI"}
        </button>
        <span className="text-xs text-muted">Saved as a draft. You review and edit before students see it.</span>
      </div>
      <div aria-live="polite" className="sm:col-span-6">
        {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      </div>
    </form>
  );
}

import { requireUser } from "@/lib/session";
import { visibleStudents } from "@/lib/scope";
import { PageHeader } from "@/components/ui";
import { lessonPlan, quiz, reportComment, parentMessage } from "./actions";
import { AiTool, Field, Select } from "./panel";

export default async function AiPage() {
  const user = await requireUser(["admin", "teacher"]);
  const students = await visibleStudents(user);

  return (
    <>
      <PageHeader title="AI Assistant" subtitle="Draft lesson plans, quizzes, report comments and parent messages in seconds. You stay in control: everything is a draft." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <AiTool title="Lesson plan" description="A timed, differentiated plan with an exit ticket." action={lessonPlan}>
          <Field label="Grade" name="grade" defaultValue="Grade 7" />
          <Field label="Subject" name="subject" defaultValue="Science" />
          <div className="sm:col-span-2"><Field label="Topic" name="topic" placeholder="e.g. Photosynthesis" /></div>
          <Field label="Minutes" name="minutes" type="number" defaultValue={45} min={10} max={180} />
        </AiTool>

        <AiTool title="Quiz generator" description="Questions, answer key and marking rubric." action={quiz}>
          <Field label="Grade" name="grade" defaultValue="Grade 7" />
          <Field label="Questions" name="count" type="number" defaultValue={8} min={3} max={20} />
          <div className="sm:col-span-2"><Field label="Topic" name="topic" placeholder="e.g. Fractions and decimals" /></div>
          <Select label="Type" name="kind" options={[{ value: "mixed", label: "Mixed" }, { value: "multiple choice", label: "Multiple choice" }, { value: "short answer", label: "Short answer" }]} />
        </AiTool>

        <AiTool title="Report card comment" description="Uses attendance and grade averages. Only the student's first name and aggregate numbers are sent to the AI." action={reportComment}>
          <div className="sm:col-span-2">
            <Select label="Student" name="studentId" options={students.map((s) => ({ value: s.id, label: `${s.name} (${s.rollNo})` }))} />
          </div>
          <Select label="Tone" name="tone" options={[{ value: "warm and encouraging", label: "Warm & encouraging" }, { value: "constructive and direct", label: "Constructive & direct" }, { value: "formal", label: "Formal" }]} />
        </AiTool>

        <AiTool title="Parent message" description="Describe the situation. Names are replaced with [Student] so no personal data leaves the school." action={parentMessage}>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="situation">Situation</label>
            <textarea id="situation" name="situation" required rows={3} className="input" placeholder="e.g. Reminder that homework has been missing for two weeks; invite to a meeting." />
          </div>
          <Select label="Tone" name="tone" options={[{ value: "friendly", label: "Friendly" }, { value: "formal", label: "Formal" }, { value: "urgent but kind", label: "Urgent but kind" }]} />
          <Field label="Language" name="language" defaultValue="English" />
        </AiTool>
      </div>
    </>
  );
}

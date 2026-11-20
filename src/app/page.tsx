import Link from "next/link";
import { CalendarCheck, GraduationCap, Wallet, Megaphone, Sparkles, ShieldCheck } from "lucide-react";

const FEATURES = [
  { icon: CalendarCheck, title: "Attendance in 30 seconds", text: "Mark the register for a whole class in one tap per exception. Parents see it the same day." },
  { icon: GraduationCap, title: "Gradebook that does the maths", text: "Weighted assessments, instant averages and letter grades, with every change audit-logged." },
  { icon: Wallet, title: "Fees without the chasing", text: "Invoices, overdue tracking and collection totals for administrators and clear statements for parents." },
  { icon: Megaphone, title: "One place for announcements", text: "Target everyone, or just parents, students or staff." },
  { icon: Sparkles, title: "AI that gives teachers time back", text: "Draft lesson plans, quizzes, report comments and parent messages. Every output is a draft you review." },
  { icon: ShieldCheck, title: "Privacy by design", text: "Role-based access, per-school data isolation, and AI prompts that never include full student identities." },
];

export default function Home() {
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="flex items-center gap-2 text-lg font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-brand-fg">🔔</span> SchoolsBell
        </span>
        <div className="flex gap-2"><Link href="/login" className="btn-ghost">Sign in</Link><Link href="/register" className="btn">Register your school</Link></div>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-4 pb-16 pt-14 text-center sm:pt-24">
          <p className="mb-4 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">School management, with AI built in</p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">Run your school. Not your spreadsheets.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted">
            Attendance, grades, fees and communication for administrators, teachers, students and parents, in one calm, fast system.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/register" className="btn !px-6 !py-3">Register your school</Link>
            <Link href="/login" className="btn-ghost !px-6 !py-3">Try the demo</Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card">
              <span className="mb-3 grid size-9 place-items-center rounded-lg bg-brand-soft text-brand"><Icon className="size-5" aria-hidden /></span>
              <h2 className="font-medium">{title}</h2>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted">© {new Date().getFullYear()} SchoolsBell</footer>
    </div>
  );
}

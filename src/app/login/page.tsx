import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { getUser } from "@/lib/session";
import { LoginForm } from "./form";

const DEMOS = [
  ["Administrator", "admin@school.test"],
  ["Teacher", "teacher@school.test"],
  ["Parent", "parent@school.test"],
  ["Student", "student@school.test"],
];

export default async function LoginPage() {
  if (await getUser()) redirect("/dashboard");
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <ThemeToggle className="fixed right-3 top-3" />
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-brand-fg">🔔</span>
          SchoolsBell
        </Link>
        <div className="card">
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mb-5 mt-1 text-sm text-muted">Use your school account to continue.</p>
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          New school? <Link href="/register" className="text-brand hover:underline">Register your school</Link>
        </p>
        <div className="mt-4 rounded-xl border border-dashed border-border p-4 text-xs text-muted">
          <p className="mb-2 font-medium text-foreground">
            Demo accounts (password: <code>password123</code>)
          </p>
          <ul className="grid grid-cols-2 gap-1">
            {DEMOS.map(([r, e]) => (
              <li key={e}>
                <span className="font-medium">{r}:</span> {e}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}

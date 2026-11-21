import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { RegisterForm } from "./form";

export const metadata = { title: "Register your school — SchoolsBell" };

export default async function RegisterPage() {
  if (await getUser()) redirect("/dashboard");
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <ThemeToggle className="fixed right-3 top-3" />
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-brand-fg">🔔</span> SchoolsBell
        </Link>
        <div className="card">
          <h1 className="text-xl font-semibold">Register your school</h1>
          <p className="mb-5 mt-1 text-sm text-muted">
            You&apos;ll be the principal: you can add teachers, students and parents, assign subjects and manage everything.
          </p>
          <RegisterForm />
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          Already registered? <Link href="/login" className="text-brand hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

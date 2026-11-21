import Link from "next/link";
import { eq } from "drizzle-orm";
import { LogOut } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { NAV, ROLE_LABEL } from "@/lib/roles";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [school] = await db.select().from(schema.schools).where(eq(schema.schools.id, user.schoolId)).limit(1);
  const items = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="mx-auto grid min-h-screen max-w-[1400px] grid-cols-[minmax(0,1fr)] md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-border p-4 md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
        <Link href="/dashboard" className="mb-4 flex items-center gap-2 px-1 text-base font-semibold md:mb-6">
          <span className="grid size-8 place-items-center rounded-lg bg-brand text-brand-fg">🔔</span>
          <span>
            SchoolsBell
            <span className="block text-[11px] font-normal text-muted">{school?.name}</span>
          </span>
        </Link>
        <Sidebar items={items} />
        <div className="mt-4 hidden border-t border-border pt-4 md:absolute md:bottom-4 md:left-4 md:right-4 md:block">
          <Link href="/account" className="block truncate text-sm font-medium hover:underline">{user.name}</Link>
          <p className="mb-2 text-xs text-muted">{user.isOwner ? "Principal" : ROLE_LABEL[user.role]}</p>
          <ThemeToggle className="mb-2" />
          <form action={logout}>
            <button className="btn-ghost w-full"><LogOut className="size-4" aria-hidden /> Sign out</button>
          </form>
        </div>
        <div className="mt-3 flex items-center justify-between md:hidden">
          <Link href="/account" className="text-sm text-muted hover:text-foreground">My account</Link>
          <ThemeToggle />
        </div>
        <form action={logout} className="mt-2 md:hidden">
          <button className="btn-ghost w-full"><LogOut className="size-4" aria-hidden /> Sign out ({user.name})</button>
        </form>
      </aside>
      <main className="min-w-0 p-4 md:p-8">{children}</main>
    </div>
  );
}

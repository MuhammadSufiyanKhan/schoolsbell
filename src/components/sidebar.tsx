"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Users,
  School,
  CalendarCheck,
  GraduationCap,
  Wallet,
  Megaphone,
  Sparkles,
  BookOpen,
  UserCog,
  UsersRound,
  UserCheck,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  school: School,
  "calendar-check": CalendarCheck,
  "graduation-cap": GraduationCap,
  wallet: Wallet,
  megaphone: Megaphone,
  sparkles: Sparkles,
  "book-open": BookOpen,
  "user-cog": UserCog,
  "users-round": UsersRound,
  "user-check": UserCheck,
};

export function Sidebar({ items }: { items: { href: string; label: string; icon: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((it) => {
        const Icon = ICONS[it.icon] ?? LayoutDashboard;
        const active = path === it.href || path.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-brand-soft text-brand" : "text-muted hover:bg-brand-soft hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

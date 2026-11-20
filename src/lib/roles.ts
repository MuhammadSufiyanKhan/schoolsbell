export type Role = "admin" | "teacher" | "student" | "parent";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
};

export type NavItem = { href: string; label: string; icon: string; roles: Role[] };

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "layout-dashboard", roles: ["admin", "teacher", "student", "parent"] },
  { href: "/students", label: "Students", icon: "users", roles: ["admin", "teacher"] },
  { href: "/classes", label: "Classes", icon: "school", roles: ["admin", "teacher"] },
  { href: "/courses", label: "Courses", icon: "book-open", roles: ["admin", "teacher", "student"] },
  { href: "/people", label: "People", icon: "user-cog", roles: ["admin"] },
  { href: "/parents", label: "Parents", icon: "users-round", roles: ["admin"] },
  { href: "/attendance", label: "Attendance", icon: "calendar-check", roles: ["admin", "teacher", "student", "parent"] },
  { href: "/grades", label: "Grades", icon: "graduation-cap", roles: ["admin", "teacher", "student", "parent"] },
  { href: "/fees", label: "Fees", icon: "wallet", roles: ["admin", "student", "parent"] },
  { href: "/announcements", label: "Announcements", icon: "megaphone", roles: ["admin", "teacher", "student", "parent"] },
  { href: "/ai", label: "AI Assistant", icon: "sparkles", roles: ["admin", "teacher"] },
];

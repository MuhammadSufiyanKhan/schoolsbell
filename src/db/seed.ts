import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { runMigrations } from "./migrate";
import {
  schools, users, classes, subjects, students, attendance,
  assessments, grades, announcements, invoices,
} from "./schema";

const DEMO_PASSWORD = "password123";

const firstNames = ["Aisha","Omar","Fatima","Ali","Zara","Hamza","Maryam","Yusuf","Sara","Bilal","Hira","Ahmed","Noor","Usman","Amina","Zain","Layla","Hassan","Iman","Talha"];
const lastNames = ["Khan","Ahmed","Malik","Sheikh","Raza","Butt","Iqbal","Siddiqui"];

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

function isoDay(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

async function main() {
  await runMigrations();
  const existing = await db.select().from(schools).limit(1);
  if (existing.length) {
    // Idempotent backfill for databases seeded before the owner flag existed.
    await db.update(users).set({ isOwner: true }).where(eq(users.email, "admin@school.test"));
    console.log("Database already seeded — skipping.");
    return;
  }
  const rand = rng(42);
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const [school] = await db.insert(schools).values({ name: "Greenfield Academy" }).returning();
  const sid = school.id;

  const [admin] = await db.insert(users).values({ schoolId: sid, name: "Principal Rahman", email: "admin@school.test", passwordHash: hash, role: "admin", isOwner: true }).returning();
  const teacherRows = await db.insert(users).values([
    { schoolId: sid, name: "Ms. Farah Noor", email: "teacher@school.test", passwordHash: hash, role: "teacher" as const },
    { schoolId: sid, name: "Mr. Daniel Cruz", email: "cruz@school.test", passwordHash: hash, role: "teacher" as const },
    { schoolId: sid, name: "Mrs. Priya Nair", email: "nair@school.test", passwordHash: hash, role: "teacher" as const },
  ]).returning();

  const classRows = await db.insert(classes).values([
    { schoolId: sid, name: "Grade 6", section: "A", teacherId: teacherRows[0].id },
    { schoolId: sid, name: "Grade 7", section: "A", teacherId: teacherRows[1].id },
    { schoolId: sid, name: "Grade 8", section: "A", teacherId: teacherRows[2].id },
  ]).returning();

  const subjectNames = ["Mathematics", "Science", "English"];
  const subjectRows = [];
  for (const c of classRows) {
    for (let i = 0; i < subjectNames.length; i++) {
      const [s] = await db.insert(subjects).values({
        schoolId: sid, classId: c.id, name: subjectNames[i], teacherId: teacherRows[i].id,
      }).returning();
      subjectRows.push(s);
    }
  }

  const parentUser = await db.insert(users).values({ schoolId: sid, name: "Mr. Imran Khan (Parent)", email: "parent@school.test", passwordHash: hash, role: "parent" }).returning();
  const studentUser = await db.insert(users).values({ schoolId: sid, name: "Aisha Khan", email: "student@school.test", passwordHash: hash, role: "student" }).returning();

  const studentRows = [];
  let n = 0;
  for (const c of classRows) {
    for (let i = 0; i < 12; i++) {
      const name = n === 0
        ? "Aisha Khan"
        : `${firstNames[(n * 7) % firstNames.length]} ${lastNames[(n * 3) % lastNames.length]}`;
      const [s] = await db.insert(students).values({
        schoolId: sid, classId: c.id, name,
        rollNo: `${c.name.replace("Grade ", "G")}-${String(i + 1).padStart(3, "0")}`,
        dob: `201${5 - Number(c.name.replace("Grade ", "")) + 6}-0${(i % 9) + 1}-1${i % 9}`,
        userId: n === 0 ? studentUser[0].id : null,
        guardianId: n === 0 || n === 1 ? parentUser[0].id : null,
      }).returning();
      studentRows.push(s);
      n++;
    }
  }

  // 20 school days of attendance (skip weekends)
  const attRows = [];
  for (const s of studentRows) {
    const bias = rand(); // some students are chronically absent -> "at risk"
    for (let d = 1; d <= 28; d++) {
      const date = new Date(); date.setDate(date.getDate() - d);
      if ([0, 6].includes(date.getDay())) continue;
      const r = rand();
      const absentP = bias > 0.9 ? 0.35 : 0.05;
      const status = r < absentP ? "absent" : r < absentP + 0.05 ? "late" : "present";
      attRows.push({ studentId: s.id, date: date.toISOString().slice(0, 10), status: status as "absent" | "late" | "present", markedBy: admin.id });
    }
  }
  for (let i = 0; i < attRows.length; i += 500) await db.insert(attendance).values(attRows.slice(i, i + 500));

  // assessments + grades
  for (const sub of subjectRows) {
    const asRows = await db.insert(assessments).values([
      { subjectId: sub.id, title: "Quiz 1", maxScore: 20, weight: 1, date: isoDay(21) },
      { subjectId: sub.id, title: "Midterm", maxScore: 100, weight: 3, date: isoDay(10) },
      { subjectId: sub.id, title: "Assignment 1", maxScore: 50, weight: 1, date: isoDay(4) },
    ]).returning();
    const classStudents = studentRows.filter((s) => s.classId === sub.classId);
    const gRows = [];
    for (const a of asRows) {
      for (const s of classStudents) {
        const ability = 0.45 + ((s.id * 37) % 50) / 100; // 0.45..0.95
        const score = Math.round(Math.min(1, Math.max(0.2, ability + (rand() - 0.5) * 0.2)) * a.maxScore * 10) / 10;
        gRows.push({ assessmentId: a.id, studentId: s.id, score });
      }
    }
    await db.insert(grades).values(gRows);
  }

  await db.insert(announcements).values([
    { schoolId: sid, authorId: admin.id, title: "Parent-Teacher Meeting", body: "The term PTM will be held next Saturday from 9am to 1pm. Please book a slot with your child's class teacher.", audience: "parents" },
    { schoolId: sid, authorId: admin.id, title: "Mid-term exam schedule published", body: "Mid-term exams begin in two weeks. Timetables have been shared with each class teacher.", audience: "all" },
    { schoolId: sid, authorId: teacherRows[0].id, title: "Staff meeting Friday", body: "All teachers: curriculum review meeting at 2pm in the staff room.", audience: "teachers" },
  ]);

  const invRows = [];
  for (const s of studentRows) {
    invRows.push({ schoolId: sid, studentId: s.id, title: "Term 2 Tuition", amountCents: 45000, dueDate: isoDay(-7), paidAt: rand() > 0.35 ? new Date() : null });
    invRows.push({ schoolId: sid, studentId: s.id, title: "Transport Fee", amountCents: 8000, dueDate: isoDay(5), paidAt: rand() > 0.5 ? new Date() : null });
  }
  await db.insert(invoices).values(invRows);

  console.log(`✓ Seeded ${studentRows.length} students. Demo password for all accounts: ${DEMO_PASSWORD}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

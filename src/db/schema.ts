import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  varchar,
  date,
  timestamp,
  real,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "teacher", "student", "parent"]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "late",
  "excused",
]);
export const audienceEnum = pgEnum("audience", ["all", "teachers", "students", "parents"]);

// Every tenant-owned table carries school_id so the app can become multi-school SaaS.
export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id").notNull().references(() => schools.id),
    name: text("name").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    // The principal who registered the school. Only the owner can create/promote other admins.
    isOwner: boolean("is_owner").notNull().default(false),
    // Staff profile. Canonical formats: phone "+923001234567", CNIC "35202-1234567-1" (see lib/pk.ts).
    phone: text("phone"),
    cnic: text("cnic"),
    /** Subjects a teacher is qualified to teach (free text, e.g. ["Mathematics", "Physics"]). */
    specializations: jsonb("specializations").$type<string[]>().notNull().default([]),
    /**
     * Parent accounts only: the auto-generated first password, AES-GCM encrypted (see lib/secrets.ts) so an
     * administrator can hand it over. Set to NULL the moment the parent changes their password.
     */
    initialPasswordEnc: text("initial_password_enc"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    // One parent account per mobile number per school (a parent with several children is ONE account).
    uniqueIndex("users_parent_phone_idx").on(t.schoolId, t.phone).where(sql`${t.role} = 'parent'`),
  ],
);

export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  name: text("name").notNull(), // e.g. "Grade 8"
  section: text("section").notNull(), // e.g. "A"
  teacherId: integer("teacher_id").references(() => users.id), // class teacher
});

export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  classId: integer("class_id").notNull().references(() => classes.id),
  name: text("name").notNull(),
  teacherId: integer("teacher_id").references(() => users.id),
});

export const students = pgTable(
  "students",
  {
    id: serial("id").primaryKey(),
    schoolId: integer("school_id").notNull().references(() => schools.id),
    userId: integer("user_id").references(() => users.id), // student login (optional)
    guardianId: integer("guardian_id").references(() => users.id), // parent login (optional)
    classId: integer("class_id").references(() => classes.id),
    name: text("name").notNull(),
    rollNo: text("roll_no").notNull(),
    dob: date("dob"),
    // Guardian contact details (separate from guardian_id, which links a parent *login*).
    guardianName: text("guardian_name"),
    guardianPhone: text("guardian_phone"),
    guardianCnic: text("guardian_cnic"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("students_class_idx").on(t.classId)],
);

export const attendance = pgTable(
  "attendance",
  {
    id: serial("id").primaryKey(),
    studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    status: attendanceStatusEnum("status").notNull(),
    markedBy: integer("marked_by").references(() => users.id),
  },
  (t) => [uniqueIndex("attendance_student_date_idx").on(t.studentId, t.date)],
);

export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  title: text("title").notNull(),
  maxScore: real("max_score").notNull().default(100),
  weight: real("weight").notNull().default(1),
  date: date("date").notNull(),
});

export const grades = pgTable(
  "grades",
  {
    id: serial("id").primaryKey(),
    assessmentId: integer("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
    studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
  },
  (t) => [uniqueIndex("grades_assessment_student_idx").on(t.assessmentId, t.studentId)],
);

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  authorId: integer("author_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: audienceEnum("audience").notNull().default("all"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  amountCents: integer("amount_cents").notNull(),
  dueDate: date("due_date").notNull(),
  paidAt: timestamp("paid_at"),
});

// Audit trail: who changed what (grades, attendance, fees...). Required for school compliance.
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ───────────────────────── LMS ─────────────────────────

export const questionKindEnum = pgEnum("question_kind", ["mcq", "short"]);
export const attemptStatusEnum = pgEnum("attempt_status", ["submitted", "ai_graded", "graded"]);

export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body"),
  url: text("url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  assessmentId: integer("assessment_id").references(() => assessments.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  instructions: text("instructions").notNull(),
  dueDate: date("due_date").notNull(),
  maxScore: real("max_score").notNull().default(100),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    assignmentId: integer("assignment_id").notNull().references(() => assignments.id, { onDelete: "cascade" }),
    studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    answer: text("answer").notNull(),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    score: real("score"),
    feedback: text("feedback"),
    gradedAt: timestamp("graded_at"),
    aiAssisted: boolean("ai_assisted").notNull().default(false),
  },
  (t) => [uniqueIndex("submissions_assignment_student_idx").on(t.assignmentId, t.studentId)],
);

export const tests = pgTable("tests", {
  id: serial("id").primaryKey(),
  schoolId: integer("school_id").notNull().references(() => schools.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
  assessmentId: integer("assessment_id").references(() => assessments.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  instructions: text("instructions"),
  published: boolean("published").notNull().default(false),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const testQuestions = pgTable("test_questions", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  kind: questionKindEnum("kind").notNull(),
  prompt: text("prompt").notNull(),
  options: jsonb("options").$type<string[]>(), // mcq only
  correctIndex: integer("correct_index"), // mcq only
  modelAnswer: text("model_answer"), // short answer: what a full-marks answer contains
  points: real("points").notNull().default(1),
});

export const testAttempts = pgTable(
  "test_attempts",
  {
    id: serial("id").primaryKey(),
    testId: integer("test_id").notNull().references(() => tests.id, { onDelete: "cascade" }),
    studentId: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    status: attemptStatusEnum("status").notNull().default("submitted"),
    totalScore: real("total_score"),
  },
  (t) => [uniqueIndex("attempts_test_student_idx").on(t.testId, t.studentId)],
);

export const testAnswers = pgTable(
  "test_answers",
  {
    id: serial("id").primaryKey(),
    attemptId: integer("attempt_id").notNull().references(() => testAttempts.id, { onDelete: "cascade" }),
    questionId: integer("question_id").notNull().references(() => testQuestions.id, { onDelete: "cascade" }),
    selectedIndex: integer("selected_index"),
    answerText: text("answer_text"),
    score: real("score"),
    feedback: text("feedback"),
    aiGraded: boolean("ai_graded").notNull().default(false),
  },
  (t) => [uniqueIndex("answers_attempt_question_idx").on(t.attemptId, t.questionId)],
);

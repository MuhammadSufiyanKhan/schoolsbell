import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/session";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { postAnnouncement } from "./actions";

export default async function AnnouncementsPage() {
  const user = await requireUser();
  const rows = await db
    .select({ a: schema.announcements, author: schema.users.name })
    .from(schema.announcements)
    .innerJoin(schema.users, eq(schema.users.id, schema.announcements.authorId))
    .where(eq(schema.announcements.schoolId, user.schoolId))
    .orderBy(desc(schema.announcements.createdAt));
  const mine = { admin: null, teacher: "teachers", student: "students", parent: "parents" }[user.role];
  const visible = rows.filter(({ a }) => a.audience === "all" || !mine || a.audience === mine);
  const canPost = user.role === "admin" || user.role === "teacher";

  return (
    <>
      <PageHeader title="Announcements" subtitle="News and notices from the school." />
      {canPost && (
        <section className="card mb-8 max-w-2xl">
          <h2 className="mb-4 text-sm font-semibold">Post an announcement</h2>
          <form action={postAnnouncement} className="space-y-3">
            <div><label className="label" htmlFor="title">Title</label><input id="title" name="title" required maxLength={150} className="input" /></div>
            <div><label className="label" htmlFor="body">Message</label><textarea id="body" name="body" required rows={4} maxLength={4000} className="input" /></div>
            <div className="flex items-end gap-3">
              <div>
                <label className="label" htmlFor="audience">Audience</label>
                <select id="audience" name="audience" className="input">
                  <option value="all">Everyone</option>
                  <option value="parents">Parents</option>
                  <option value="students">Students</option>
                  <option value="teachers">Teachers</option>
                </select>
              </div>
              <button className="btn">Publish</button>
            </div>
          </form>
        </section>
      )}
      {visible.length === 0 ? <Empty>No announcements yet.</Empty> : (
        <div className="max-w-2xl space-y-3">
          {visible.map(({ a, author }) => (
            <article key={a.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium">{a.title}</h3>
                <Badge tone="brand">{a.audience}</Badge>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm">{a.body}</p>
              <p className="mt-3 text-xs text-muted">{author} · {a.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

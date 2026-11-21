import { getUser, type SessionUser } from "./session";

export const jsonResponse = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/** Shared checks for staff-only API routes. Returns the user, or the Response to send back. */
export async function staffOnly(req: Request, what: string): Promise<SessionUser | Response> {
  // Cookies are SameSite=Lax; also refuse a mismatched Origin outright.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return jsonResponse({ error: "Cross-site request blocked." }, 403);
    } catch {
      return jsonResponse({ error: "Bad request." }, 400);
    }
  }
  const user = await getUser();
  if (!user) return jsonResponse({ error: "Please sign in again." }, 401);
  if (user.role !== "admin" && user.role !== "teacher") return jsonResponse({ error: `Only teachers and administrators can ${what}.` }, 403);
  return user;
}

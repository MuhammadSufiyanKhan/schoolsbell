/** The app-wide secret. Required in production; a fixed dev value locally so `npm run dev` just works. */
export function getSecretString() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return s ?? "dev-only-insecure-secret-change-me-please-32b";
}

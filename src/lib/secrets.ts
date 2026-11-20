import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { getSecretString } from "./secret-key";

/**
 * Reversible encryption for the *initial* password of auto-created parent accounts, so an administrator
 * can hand it over. AES-256-GCM (authenticated: tampering is detected). The key is derived from
 * SESSION_SECRET with HKDF under a dedicated label, so it is never the same key as the session-signing one.
 * If SESSION_SECRET is rotated, old values simply fail to decrypt and the admin resets the password.
 */
const keyFor = () => Buffer.from(hkdfSync("sha256", getSecretString(), "schoolsbell", "initial-password-v1", 32));

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFor(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${ct.toString("base64url")}`;
}

/** Returns null (never throws) if the value is malformed, tampered with, or the key changed. */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const [v, iv, tag, ct] = stored.split(".");
    if (v !== "v1" || !iv || !tag || !ct) return null;
    const d = createDecipheriv("aes-256-gcm", keyFor(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

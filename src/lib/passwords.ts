import "server-only";
import { randomInt } from "node:crypto";

// No look-alike characters (0/O, 1/l/I) so credentials can be read out or typed from paper.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Cryptographically random one-time password. */
export function generatePassword(length = 12) {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

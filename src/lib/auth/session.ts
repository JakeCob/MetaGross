/**
 * Single-user passcode auth.
 *
 * The session cookie is an HMAC-signed timestamp:
 *   `${issuedAtMs}.${base64url(HMAC_SHA256(secret, issuedAtMs))}`
 *
 * No database, no session store — proving that the holder knew the
 * passcode at sign-in time is enough. Cookies are server-issued and
 * HTTP-only, so a JS-injection attacker can't steal them. Built on
 * Web Crypto so the same code runs in middleware (Edge runtime),
 * route handlers, and tests.
 */

export const SESSION_COOKIE_NAME = "metagross_session";

/** Default lifetime — 30 days. Long enough for personal use. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Read the auth secret. Throws if missing — auth must fail closed. */
export function requireAuthSecret(): string {
  const s =
    process.env.METAGROSS_AUTH_SECRET ?? process.env.AUTH_SECRET ?? "";
  if (!s || s.length < 16) {
    throw new Error(
      "METAGROSS_AUTH_SECRET is missing or too short (need ≥16 chars). Set it in .env so session cookies can be signed.",
    );
  }
  return s;
}

/** Read the passcode the user must type to sign in. */
export function requirePasscode(): string {
  const p = process.env.METAGROSS_PASSCODE ?? "";
  if (!p) {
    throw new Error(
      "METAGROSS_PASSCODE is missing. Set it in .env to enable sign-in.",
    );
  }
  return p;
}

function base64UrlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // btoa is available in both browser, Node 18+, and Edge runtime.
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const bin = atob(padded + "=".repeat(padLen));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return base64UrlEncode(sig);
}

async function hmacVerify(
  secret: string,
  message: string,
  signature: string,
): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  let sigBytes: Uint8Array;
  try {
    sigBytes = base64UrlDecode(signature);
  } catch {
    return false;
  }
  return crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    enc.encode(message),
  );
}

export async function issueSessionToken(
  secret: string = requireAuthSecret(),
  now: number = Date.now(),
): Promise<string> {
  const issuedAt = String(now);
  const sig = await hmacSign(secret, issuedAt);
  return `${issuedAt}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  secret?: string,
  now: number = Date.now(),
  ttlMs: number = SESSION_TTL_MS,
): Promise<boolean> {
  if (!token || typeof token !== "string") return false;
  // Read the secret lazily — middleware (Edge runtime) sometimes
  // doesn't pass it in. If neither the call site supplies one nor
  // process.env has one, fail closed (return false) instead of
  // throwing, so middleware can short-circuit to a redirect.
  const realSecret =
    secret ??
    process.env.METAGROSS_AUTH_SECRET ??
    process.env.AUTH_SECRET ??
    "";
  if (!realSecret || realSecret.length < 16) return false;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  const issuedAt = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const issuedMs = Number(issuedAt);
  if (!Number.isFinite(issuedMs)) return false;
  if (now - issuedMs > ttlMs) return false;
  if (issuedMs - now > 60_000) return false; // anti-replay drift
  return hmacVerify(realSecret, issuedAt, sig);
}

/**
 * Constant-time string equality. Used to compare submitted passcodes
 * against the configured one. Web Crypto doesn't have a string compare
 * primitive but we can XOR each char.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

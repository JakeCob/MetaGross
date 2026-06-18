/**
 * Cron authentication — lets a scheduler (Vercel Cron, GitHub Actions, or
 * any external job) trigger the otherwise session-gated meta-team refresh
 * endpoints without a passcode session.
 *
 * The scheduler sends `Authorization: Bearer <CRON_SECRET>`. Vercel Cron
 * does this automatically when a `CRON_SECRET` env var is set; other
 * schedulers add the header explicitly. Fails closed when no secret is
 * configured, so the endpoints stay session-only until you opt in.
 */
import { timingSafeEqual } from "./session";

/** Paths a valid cron bearer may reach (mirrors vercel.json `crons`). */
export const CRON_PATHS: readonly string[] = [
  "/api/meta-teams/aggregate",
  "/api/meta-teams/scrape",
];

/** Read the cron secret. Returns "" when unset/too short (auth fails closed). */
function cronSecret(): string {
  const s = process.env.CRON_SECRET?.trim() ?? "";
  return s.length >= 16 ? s : "";
}

/**
 * True when the request carries a valid `Authorization: Bearer <CRON_SECRET>`.
 * Constant-time compare to avoid leaking the secret via timing.
 */
export function isCronRequest(headers: Headers): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const auth = headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!auth.startsWith(prefix)) return false;
  return timingSafeEqual(auth.slice(prefix.length), secret);
}

/** True when the path is one a cron job is allowed to trigger. */
export function isCronPath(pathname: string): boolean {
  return CRON_PATHS.includes(pathname);
}

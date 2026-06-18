import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isCronRequest, isCronPath, CRON_PATHS } from "../cron";

const SECRET = "test-cron-secret-0123456789"; // ≥16 chars

function headers(auth?: string): Headers {
  const h = new Headers();
  if (auth !== undefined) h.set("authorization", auth);
  return h;
}

describe("isCronPath", () => {
  it("accepts the registered cron paths", () => {
    for (const p of CRON_PATHS) expect(isCronPath(p)).toBe(true);
    expect(isCronPath("/api/meta-teams/aggregate")).toBe(true);
  });

  it("rejects other paths", () => {
    expect(isCronPath("/api/teams")).toBe(false);
    expect(isCronPath("/api/meta-teams/match")).toBe(false);
  });
});

describe("isCronRequest", () => {
  const prev = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it("accepts a correct Bearer token", () => {
    expect(isCronRequest(headers(`Bearer ${SECRET}`))).toBe(true);
  });

  it("rejects a wrong token", () => {
    expect(isCronRequest(headers("Bearer nope"))).toBe(false);
  });

  it("rejects a missing or malformed header", () => {
    expect(isCronRequest(headers())).toBe(false);
    expect(isCronRequest(headers(SECRET))).toBe(false); // no "Bearer " prefix
  });

  it("fails closed when no secret is configured", () => {
    delete process.env.CRON_SECRET;
    expect(isCronRequest(headers(`Bearer ${SECRET}`))).toBe(false);
  });

  it("fails closed when the secret is too short", () => {
    process.env.CRON_SECRET = "short";
    expect(isCronRequest(headers("Bearer short"))).toBe(false);
  });
});

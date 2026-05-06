import { describe, it, expect } from "vitest";
import {
  issueSessionToken,
  verifySessionToken,
  timingSafeEqual,
  SESSION_TTL_MS,
} from "../session";

const SECRET = "test-secret-1234567890abcdef";

describe("session token", () => {
  it("round-trips a freshly issued token", async () => {
    const token = await issueSessionToken(SECRET);
    expect(typeof token).toBe("string");
    expect(token).toContain(".");
    const ok = await verifySessionToken(token, SECRET);
    expect(ok).toBe(true);
  });

  it("rejects undefined / null / empty", async () => {
    expect(await verifySessionToken(undefined, SECRET)).toBe(false);
    expect(await verifySessionToken(null, SECRET)).toBe(false);
    expect(await verifySessionToken("", SECRET)).toBe(false);
  });

  it("rejects malformed token (no dot, single segment)", async () => {
    expect(await verifySessionToken("abc", SECRET)).toBe(false);
    expect(await verifySessionToken("123.", SECRET)).toBe(false);
    expect(await verifySessionToken(".abc", SECRET)).toBe(false);
  });

  it("rejects tokens signed with the wrong secret", async () => {
    const token = await issueSessionToken(SECRET);
    expect(await verifySessionToken(token, "different-secret-aaaaaaa")).toBe(
      false,
    );
  });

  it("rejects tampered signatures", async () => {
    const token = await issueSessionToken(SECRET);
    const [issuedAt, sig] = token.split(".");
    const last = sig.slice(-1);
    const flipped = last === "A" ? "B" : "A";
    const tampered = `${issuedAt}.${sig.slice(0, -1)}${flipped}`;
    expect(await verifySessionToken(tampered, SECRET)).toBe(false);
  });

  it("rejects tampered timestamps (signature won't match)", async () => {
    const token = await issueSessionToken(SECRET);
    const sig = token.split(".")[1];
    const tampered = `${Date.now() + 1000}.${sig}`;
    expect(await verifySessionToken(tampered, SECRET)).toBe(false);
  });

  it("expires tokens past TTL", async () => {
    const stale = await issueSessionToken(
      SECRET,
      Date.now() - (SESSION_TTL_MS + 60_000),
    );
    expect(await verifySessionToken(stale, SECRET)).toBe(false);
  });

  it("rejects tokens issued in the future (anti-replay)", async () => {
    const future = await issueSessionToken(SECRET, Date.now() + 5 * 60_000);
    expect(await verifySessionToken(future, SECRET)).toBe(false);
  });

  it("rejects non-numeric issuedAt", async () => {
    expect(
      await verifySessionToken("not-a-number.abc", SECRET),
    ).toBe(false);
  });
});

describe("timingSafeEqual", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqual("hello", "hello")).toBe(true);
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("returns false for different lengths", () => {
    expect(timingSafeEqual("a", "ab")).toBe(false);
    expect(timingSafeEqual("", "x")).toBe(false);
  });

  it("returns false for different content", () => {
    expect(timingSafeEqual("hello", "world")).toBe(false);
    expect(timingSafeEqual("password1", "password2")).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isAuthError,
  markProviderBroken,
  pickFallbackProvider,
  resolveProviderHealthy,
  providerHasCredentials,
} from "../graph/model";

// We can't directly reset the module-scope brokenProviders set without
// adding a hatch, but we can verify the public behaviour by going from
// "all healthy" to "one broken" within a single test and observing the
// resolveProvider / pickFallbackProvider output. Each test sets only
// its own subset of env keys to keep the assertions hermetic.

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  process.env.OPENAI_API_KEY = ORIGINAL_ENV.OPENAI_API_KEY;
  process.env.OPENROUTER_API_KEY = ORIGINAL_ENV.OPENROUTER_API_KEY;
  process.env.ANTHROPIC_API_KEY = ORIGINAL_ENV.ANTHROPIC_API_KEY;
});

describe("isAuthError", () => {
  it("flags status 401 and 403", () => {
    expect(isAuthError({ status: 401 })).toBe(true);
    expect(isAuthError({ status: 403 })).toBe(true);
    expect(isAuthError({ statusCode: 401 })).toBe(true);
    expect(isAuthError({ response: { status: 401 } })).toBe(true);
    expect(isAuthError({ cause: { status: 401 } })).toBe(true);
  });

  it("flags OpenAI 'project archived' message", () => {
    expect(
      isAuthError(new Error("The project you are requesting has been archived")),
    ).toBe(true);
  });

  it("flags generic 'invalid api key' / 'unauthorized' messages", () => {
    expect(isAuthError(new Error("Incorrect API key provided"))).toBe(true);
    expect(isAuthError(new Error("Unauthorized"))).toBe(true);
    expect(isAuthError(new Error("authentication failed"))).toBe(true);
  });

  it("does NOT flag non-auth errors", () => {
    expect(isAuthError({ status: 500 })).toBe(false);
    expect(isAuthError(new Error("rate limit exceeded"))).toBe(false);
    expect(isAuthError(new Error("timeout"))).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
  });
});

describe("providerHasCredentials", () => {
  it("returns true only when the matching env key is set", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-xxx";
    expect(providerHasCredentials("openrouter")).toBe(true);
    expect(providerHasCredentials("openai")).toBe(false);
    expect(providerHasCredentials("anthropic")).toBe(false);
  });
});

describe("resolveProviderHealthy + pickFallbackProvider", () => {
  it("honours an override when its env key is set and it's not broken", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-xxx";
    expect(resolveProviderHealthy("openrouter")).toBe("openrouter");
  });

  it("falls through when the override has no env key", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-xxx";
    // override asks for openai but only openrouter is configured
    expect(resolveProviderHealthy("openai")).toBe("openrouter");
  });

  it("after markProviderBroken, resolveProviderHealthy skips it", () => {
    process.env.OPENAI_API_KEY = "sk-dead";
    process.env.OPENROUTER_API_KEY = "sk-or-xxx";
    // (Once any earlier test marks 'openai' broken via this same import,
    // the result here will be openrouter without needing to mark again.
    // We mark explicitly to make the assertion robust regardless of test
    // ordering.)
    markProviderBroken("openai");
    expect(resolveProviderHealthy("openai")).toBe("openrouter");
  });

  it("pickFallbackProvider returns next healthy provider in order", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-xxx";
    process.env.ANTHROPIC_API_KEY = "sk-ant-xxx";
    // openai is broken from the previous test → next healthy is openrouter
    expect(pickFallbackProvider("openai")).toBe("openrouter");
    // walking from openrouter → next healthy is anthropic
    expect(pickFallbackProvider("openrouter")).toBe("anthropic");
  });

  it("pickFallbackProvider returns null when nothing else is available", () => {
    // only openrouter is configured, and we're already on it
    process.env.OPENROUTER_API_KEY = "sk-or-xxx";
    expect(pickFallbackProvider("openrouter")).toBeNull();
  });
});

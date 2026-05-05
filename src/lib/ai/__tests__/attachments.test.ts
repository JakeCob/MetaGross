import { describe, it, expect } from "vitest";
import { sanitizeAgentAttachments } from "../attachments";

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==";
const tinyJpg = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD//Z";

describe("sanitizeAgentAttachments", () => {
  it("returns [] for non-array input", () => {
    expect(sanitizeAgentAttachments(undefined)).toEqual([]);
    expect(sanitizeAgentAttachments(null)).toEqual([]);
    expect(sanitizeAgentAttachments({ foo: 1 })).toEqual([]);
    expect(sanitizeAgentAttachments("nope")).toEqual([]);
  });

  it("returns [] for empty array", () => {
    expect(sanitizeAgentAttachments([])).toEqual([]);
  });

  it("keeps valid image attachments", () => {
    const out = sanitizeAgentAttachments([
      { name: "shot.png", mimeType: "image/png", dataUrl: tinyPng },
      { name: "shot.jpg", mimeType: "image/jpeg", dataUrl: tinyJpg },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].dataUrl).toBe(tinyPng);
    expect(out[1].dataUrl).toBe(tinyJpg);
  });

  it("rejects non-image MIME types", () => {
    const out = sanitizeAgentAttachments([
      { name: "evil.exe", mimeType: "application/x-msdownload", dataUrl: "data:application/x-msdownload;base64,AA==" },
      { name: "txt", mimeType: "text/plain", dataUrl: "data:text/plain;base64,QUE=" },
    ]);
    expect(out).toEqual([]);
  });

  it("rejects mismatched data URL prefix even when mimeType says image", () => {
    // Attacker tries to claim image mime but dataUrl is JS — common
    // bypass attempt for vision-prompt-injection setups.
    const out = sanitizeAgentAttachments([
      {
        name: "trick.png",
        mimeType: "image/png",
        dataUrl: "data:text/javascript;base64,QUE=",
      },
    ]);
    expect(out).toEqual([]);
  });

  it("rejects entries missing required fields", () => {
    const out = sanitizeAgentAttachments([
      { mimeType: "image/png", dataUrl: tinyPng }, // missing name
      { name: "x", dataUrl: tinyPng }, // missing mimeType
      { name: "x", mimeType: "image/png" }, // missing dataUrl
      null,
      "string",
    ]);
    expect(out).toEqual([]);
  });

  it("caps the count at maxCount (default 4)", () => {
    const arr = Array.from({ length: 10 }, () => ({
      name: "p.png",
      mimeType: "image/png",
      dataUrl: tinyPng,
    }));
    const out = sanitizeAgentAttachments(arr);
    expect(out).toHaveLength(4);
  });

  it("respects custom maxCount", () => {
    const arr = Array.from({ length: 10 }, () => ({
      name: "p.png",
      mimeType: "image/png",
      dataUrl: tinyPng,
    }));
    expect(sanitizeAgentAttachments(arr, { maxCount: 2 })).toHaveLength(2);
  });

  it("trims oversized data URLs to maxBytesPerItem", () => {
    const giant =
      "data:image/png;base64," + "A".repeat(20 * 1024 * 1024);
    const out = sanitizeAgentAttachments(
      [{ name: "huge.png", mimeType: "image/png", dataUrl: giant }],
      { maxBytesPerItem: 1024 },
    );
    expect(out[0].dataUrl.length).toBe(1024);
  });
});

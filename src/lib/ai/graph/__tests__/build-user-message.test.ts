import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { HumanMessage } from "@langchain/core/messages";
import { buildUserMessage } from "../index";

describe("buildUserMessage — multimodal seed message", () => {
  it("produces a plain HumanMessage when there are no attachments", () => {
    const m = buildUserMessage("hello");
    expect(m).toBeInstanceOf(HumanMessage);
    expect(typeof m.content).toBe("string");
    expect(m.content).toBe("hello");
  });

  it("produces a content-array message when attachments are present", () => {
    const tinyPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAfbLI3wAAAABJRU5ErkJggg==";
    const m = buildUserMessage("what's in this image?", [
      { name: "test.png", mimeType: "image/png", dataUrl: tinyPng },
    ]);
    expect(m).toBeInstanceOf(HumanMessage);
    expect(Array.isArray(m.content)).toBe(true);
    const blocks = m.content as Array<Record<string, unknown>>;
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: "text", text: "what's in this image?" });
    expect(blocks[1]).toMatchObject({
      type: "image_url",
      image_url: { url: tinyPng },
    });
  });

  it("emits one image_url block per attachment in the original order", () => {
    const a = "data:image/png;base64,AAA=";
    const b = "data:image/jpeg;base64,/9j/=";
    const c = "data:image/webp;base64,UklGR=";
    const m = buildUserMessage("compare these", [
      { dataUrl: a },
      { dataUrl: b },
      { dataUrl: c },
    ]);
    const blocks = m.content as Array<{ type: string; image_url?: { url: string } }>;
    expect(blocks).toHaveLength(4); // 1 text + 3 images
    expect(blocks[1].image_url?.url).toBe(a);
    expect(blocks[2].image_url?.url).toBe(b);
    expect(blocks[3].image_url?.url).toBe(c);
  });

  it("uses the data URL verbatim — no re-encoding or truncation", () => {
    // The attachment may include a name and mimeType but only `dataUrl`
    // gets passed to the model. The builder must NOT mutate it.
    const original =
      "data:image/png;base64," + "A".repeat(2048);
    const m = buildUserMessage("x", [
      { name: "big.png", mimeType: "image/png", dataUrl: original },
    ]);
    const blocks = m.content as Array<{ image_url?: { url: string } }>;
    expect(blocks[1].image_url?.url).toBe(original);
    expect(blocks[1].image_url?.url.length).toBe(original.length);
  });

  it("treats an empty attachments array the same as undefined", () => {
    const m = buildUserMessage("plain", []);
    expect(typeof m.content).toBe("string");
    expect(m.content).toBe("plain");
  });
});

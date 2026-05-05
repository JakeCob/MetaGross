import { describe, expect, it } from "vitest";
import { extractSpeciesMentions } from "../graph/species-mentions";

describe("extractSpeciesMentions", () => {
  it("does not treat title-cased prose headings as Pokemon", () => {
    const mentions = extractSpeciesMentions(`**What**\n**Better**\n**Important**`);
    expect(mentions).toEqual([]);
  });

  it("still catches real Pokemon in prose", () => {
    const mentions = extractSpeciesMentions(
      "Heatran is a clean Mega Scizor answer, but Milotic should stay.",
    );
    expect(mentions).toContain("Heatran");
    expect(mentions).toContain("Milotic");
  });
});

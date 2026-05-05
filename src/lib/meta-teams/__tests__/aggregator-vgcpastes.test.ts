import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseCsv, buildHeaderMap } from "../aggregator-vgcpastes";

describe("parseCsv", () => {
  it("splits a basic comma-separated row", () => {
    const out = parseCsv("a,b,c\n1,2,3\n");
    expect(out).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted cells with embedded commas", () => {
    const out = parseCsv(`name,team\n"Wolfe","Scovillain, Primarina, Sneasler"\n`);
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual(["Wolfe", "Scovillain, Primarina, Sneasler"]);
  });

  it("handles escaped quotes inside cells (\"\" → \")", () => {
    const out = parseCsv(`a,b\n"He said ""hi""","ok"\n`);
    expect(out[1]).toEqual([`He said "hi"`, "ok"]);
  });

  it("preserves newlines inside quoted cells", () => {
    // VGCPastes header row literally has 'Replica Code\n(Click text...)'
    // inside quotes — make sure we don't split on the embedded \n.
    const out = parseCsv(`a,"Replica Code\n(Click text for image)",c\n1,2,3\n`);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual([
      "a",
      "Replica Code\n(Click text for image)",
      "c",
    ]);
  });

  it("preserves empty cells", () => {
    const out = parseCsv("a,,b\n1,,3\n");
    expect(out[0]).toEqual(["a", "", "b"]);
    expect(out[1]).toEqual(["1", "", "3"]);
  });

  it("survives trailing whitespace and missing final newline", () => {
    const out = parseCsv("a,b,c\n1,2,3");
    expect(out).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });
});

describe("buildHeaderMap", () => {
  // Real fixture: trimmed but column-positions match the live sheet
  // captured 2026-04-27. If VGCPastes shifts columns later, this test
  // intentionally fails so we re-check before re-deploying.
  const liveHeader =
    "Team ID,Team Description,,Full Name,,1,,,2,,,3,,,4,,,5,,,6,,,,Pokepaste,EVs,Extracted paste?,Replica Status,Replica Code,Date Shared,Tournament / Event,Rank,Link to Source,Report / Video,Other Links,Owner,,Pokemon Text for Copypasta,,,,,,,Team ID";

  it("locates the header row + maps the columns we use", () => {
    const rows = parseCsv(`title row\nsubtitle row\n${liveHeader}\n`);
    const map = buildHeaderMap(rows);
    expect(map).not.toBeNull();
    expect(map!.headerRow).toBe(2);
    expect(map!.index["team id"]).toBe(0);
    expect(map!.index["pokepaste"]).toBe(24);
    expect(map!.index["tournament / event"]).toBe(30);
    expect(map!.index["link to source"]).toBe(32);
    expect(map!.index["owner"]).toBe(35);
    expect(map!.index["pokemon text for copypasta"]).toBe(37);
    // Species columns start AT the anchor (37) and span 6 cells.
    expect(map!.speciesColumns).toEqual([37, 38, 39, 40, 41, 42]);
  });

  it("returns null when the sheet doesn't have the expected anchors", () => {
    const rows = parseCsv("foo,bar\n1,2\n");
    expect(buildHeaderMap(rows)).toBeNull();
  });
});

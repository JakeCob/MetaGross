/**
 * Focused regression test: the validator used to only scan `### Species`
 * headings, so agents writing numbered-list teams ("1. Rillaboom") got
 * away with NOT_IN_CHAMPIONS species. These tests lock in the broadened
 * detection so that regression cannot return silently.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { validateResponseNode } from "../graph/nodes/validate-response";
import type { AgentStateType } from "../graph/state";

function stateFor(
  content: string,
  userMessage: string = "Build me a team",
): AgentStateType {
  return {
    messages: [
      new HumanMessage(userMessage),
      new AIMessage({ id: "resp", content }),
    ],
    threadId: "t",
    contextType: "team",
    contextId: null,
    persona: "default",
    loadedContext: null,
    memoryHits: [],
    pendingAction: null,
    verificationRetries: 0,
    providerOverride: null,
    modelOverride: null,
    draftTeam: null,
    extractedMemoriesThisTurn: [],
  };
}

describe("validateResponseNode — species detection drift", () => {
  it("catches NOT_IN_CHAMPIONS species in a numbered list (1. Rillaboom)", async () => {
    const content = `Here's a 6-mon team:

1. Talonflame
- Tailwind
- Brave Bird

6. Rillaboom
- Grassy Glide
- Fake Out
- Wood Hammer
- U-turn`;
    const result = await validateResponseNode(stateFor(content));
    // When violations are found, validate-response returns a messages
    // array with the replacement AIMessage. Empty return = no issues.
    expect(result.messages).toBeTruthy();
  });

  it("catches NOT_IN_CHAMPIONS species mentioned only in prose (no heading)", async () => {
    const content = `Mega Scovillain pairs well with Rillaboom — Grassy Terrain powers up Grassy Glide.`;
    const result = await validateResponseNode(stateFor(content));
    expect(result.messages).toBeTruthy();
  });

  it("catches allowlist misses mentioned only in prose (Heatran)", async () => {
    const content = `Keep Milotic. For Mega Scizor, Heatran is the cleanest answer and pairs well with Farigiraf.`;
    const result = await validateResponseNode(stateFor(content));
    const replacement = (
      Array.isArray(result.messages) ? result.messages[0] : undefined
    ) as AIMessage | undefined;
    expect(replacement).toBeTruthy();
    expect(String(replacement?.content ?? "")).toContain("Heatran");
    expect(String(replacement?.content ?? "")).toContain("safe to use");
  });

  it("does NOT demand 6 Pokemon when the user asked a yes/no question about one slot", async () => {
    // Bug regression: "is Pelipper's Focus Sash ok?" got rejected
    // because the agent's helpful prose mentioned 3-4 Pokemon and used
    // a couple of `###` headings to organise the answer. The team-size
    // check should ONLY fire when the user actually asked for a team.
    const content = `### Pelipper's Focus Sash

Yes, Focus Sash on Pelipper is fine. It guarantees one Tailwind turn before going down.

### Better alternatives

If you want to swap, consider Sitrus Berry for sustain or a type-resist berry like Wacan Berry against Electric coverage.

Pelipper pairs well with Basculegion and Archaludon. Whimsicott counters it hard.`;
    const result = await validateResponseNode(
      stateFor(
        content,
        "Pelipper is holding a focus sash in my team, is that ok?",
      ),
    );
    // No team-size complaint — the user didn't ask for a team.
    expect(result.messages).toBeFalsy();
  });

  it("STILL demands 6 Pokemon when the user explicitly asked for a team", async () => {
    const content = `## Team

### Incineroar
- **Ability**: Intimidate
- **Item**: Sitrus Berry
- **Moves**: Fake Out / Flare Blitz / Darkest Lariat / Parting Shot
- **Role**: Pivot
- **Points**: HP 32 / Atk 2 / Def 10 / SpA 0 / SpD 22 / Spe 0

### Garchomp
- **Ability**: Rough Skin
- **Item**: Focus Sash
- **Moves**: Earthquake / Dragon Claw / Rock Slide / Protect
- **Role**: Physical attacker
- **Points**: HP 4 / Atk 32 / Def 0 / SpA 0 / SpD 0 / Spe 30`;
    const result = await validateResponseNode(
      stateFor(content, "build me a 6-mon VGC team"),
    );
    // Validator should flag — only 2 of 6 species delivered.
    expect(result.messages).toBeTruthy();
  });

  it("leaves legal numbered-list teams alone", async () => {
    const content = `## Team

1. Incineroar
- **Ability**: Intimidate
- **Item**: Sitrus Berry
- **Nature**: Careful
- **Moves**: Fake Out / Flare Blitz / Darkest Lariat / Parting Shot
- **Role**: Glue support
- **Points**: HP 32 / Atk 2 / Def 10 / SpA 0 / SpD 22 / Spe 0

2. Garchomp
- **Ability**: Rough Skin
- **Item**: Focus Sash
- **Nature**: Jolly
- **Moves**: Earthquake / Dragon Claw / Rock Slide / Protect
- **Role**: Physical attacker
- **Points**: HP 4 / Atk 32 / Def 0 / SpA 0 / SpD 0 / Spe 30

3. Sneasler
- **Ability**: Unburden
- **Item**: White Herb
- **Nature**: Jolly
- **Moves**: Dire Claw / Close Combat / Acrobatics / Protect
- **Role**: Physical attacker
- **Points**: HP 4 / Atk 32 / Def 0 / SpA 0 / SpD 0 / Spe 30

4. Sinistcha
- **Ability**: Hospitality
- **Item**: Leftovers
- **Nature**: Calm
- **Moves**: Matcha Gotcha / Rage Powder / Trick Room / Protect
- **Role**: Support
- **Points**: HP 32 / Atk 0 / Def 4 / SpA 0 / SpD 30 / Spe 0

5. Dragonite
- **Ability**: Inner Focus
- **Item**: Dragoninite
- **Nature**: Adamant
- **Moves**: Extreme Speed / Scale Shot / Ice Spinner / Protect
- **Role**: Physical attacker
- **Points**: HP 4 / Atk 32 / Def 0 / SpA 0 / SpD 0 / Spe 30

6. Starmie
- **Ability**: Illuminate
- **Item**: Starminite
- **Nature**: Timid
- **Moves**: Hydro Pump / Psychic / Ice Beam / Protect
- **Role**: Special attacker
- **Points**: HP 4 / Atk 0 / Def 0 / SpA 32 / SpD 0 / Spe 30`;
    const result = await validateResponseNode(stateFor(content));
    // All legal species + all fields clean → empty return (no issues).
    expect(result.messages).toBeFalsy();
  });

  it("does not demand 6 Pokemon for single-slot analysis replies", async () => {
    const result = await validateResponseNode({
      ...stateFor(
        "Dragon Tail on Milotic helps phaze Trick Room turns, but you give up Haze and become worse into setup sweepers that stay on the field.",
      ),
      messages: [
        new HumanMessage("Build me a team"),
        new HumanMessage(
          "Or let's just add Dragon Tail again on Milotic to counter Trick Room.",
        ),
        new AIMessage({
          id: "resp",
          content:
            "Dragon Tail on Milotic helps phaze Trick Room turns, but you give up Haze and become worse into setup sweepers that stay on the field.",
        }),
      ],
    });

    expect(result.messages).toBeFalsy();
  });
});

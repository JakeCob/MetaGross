import { describe, expect, it } from "vitest";
import {
  isAssistantConfirmationLoop,
  isPatchClarificationQuestion,
  hasTeamContextForPatch,
  isDirectTeamEditRequest,
  isTentativeTeamEditSuggestion,
} from "../graph/edit-intent";

describe("edit intent detection", () => {
  it("detects direct replacement requests", () => {
    expect(
      isDirectTeamEditRequest(
        "I think I could add Farigiraf, and I don't use Incineroar much so let's replace it.",
      ),
    ).toBe(true);
  });

  it("detects move patch requests", () => {
    expect(
      isDirectTeamEditRequest(
        "We could also add Wide Guard to my Pokemon to solve Water Spout.",
      ),
    ).toBe(true);
  });

  it("does not treat explanation questions as patch requests", () => {
    expect(isDirectTeamEditRequest("why did you replace milotic?")).toBe(
      false,
    );
  });

  it("does not force patch mode for analysis questions about a replacement", () => {
    expect(
      isDirectTeamEditRequest(
        "Do you agree to replace Incineroar with Farigiraf? Do a deep analysis.",
      ),
    ).toBe(false);
  });

  it("treats 'should we' deliberations as analysis, not direct edits", () => {
    // Bug regression: "should we change flash cannon to protect on
    // Archaludon" matched the change-X-to-Y pattern and forced
    // patch-mode, triggering a validator self-correction loop. It's
    // a deliberation question — answer with discussion, optionally
    // offer the patch.
    expect(
      isDirectTeamEditRequest(
        "should we change flash cannon to protect on Archaludon",
      ),
    ).toBe(false);
    expect(
      isDirectTeamEditRequest(
        "Should we swap Sneasler for Kingambit?",
      ),
    ).toBe(false);
    expect(
      isDirectTeamEditRequest("Is this a good idea to replace X with Y?"),
    ).toBe(false);
    expect(
      isDirectTeamEditRequest(
        "Would changing Conkeldurr's nature to Brave help here?",
      ),
    ).toBe(false);
    expect(
      isDirectTeamEditRequest("Is it worth trying Quick Guard over Protect?"),
    ).toBe(false);
    expect(
      isDirectTeamEditRequest("How about Quick Guard instead of Protect?"),
    ).toBe(false);
  });

  it("still treats polite action requests as patch requests", () => {
    expect(
      isDirectTeamEditRequest(
        "Could you replace Incineroar with Farigiraf and keep the rest the same?",
      ),
    ).toBe(true);
  });

  it("treats alternative option suggestions as analysis-first, not apply-now", () => {
    expect(
      isDirectTeamEditRequest(
        "Or let's just add Dragon Tail again on Milotic to counter Trick Room.",
      ),
    ).toBe(false);
    expect(
      isTentativeTeamEditSuggestion(
        "Or let's just add Dragon Tail again on Milotic to counter Trick Room.",
      ),
    ).toBe(true);
  });

  it("recognizes confirmation loops as invalid patch responses", () => {
    expect(
      isAssistantConfirmationLoop(
        "Do you agree to replace Incineroar with Farigiraf?",
      ),
    ).toBe(true);
    expect(
      isPatchClarificationQuestion(
        "Do you agree to replace Incineroar with Farigiraf?",
      ),
    ).toBe(false);
  });

  it("allows real clarification questions", () => {
    expect(
      isPatchClarificationQuestion(
        "Which Pokemon do you want to give Wide Guard to?",
      ),
    ).toBe(true);
  });

  it("detects either saved-team or draft-team context", () => {
    expect(
      hasTeamContextForPatch({
        loadedContext: { type: "team", pokemon: [{ species: "Milotic" }] },
        draftTeam: null,
      }),
    ).toBe(true);

    expect(
      hasTeamContextForPatch({
        loadedContext: null,
        draftTeam: { pokemon: [{ species: "Milotic" }] },
      }),
    ).toBe(true);
  });
});

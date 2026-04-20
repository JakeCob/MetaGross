/**
 * Renders the PokemonCardRenderer with various markdown inputs and
 * asserts that ResearchTeamCards appear. Specifically covers the
 * three drift formats we've observed from GPT-5.4 so regressions
 * in the parser don't silently break the research-card rendering.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/image — PokemonSprite uses it and it requires Next runtime.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    return (
      <img
        src={typeof props.src === "string" ? props.src : ""}
        alt={typeof props.alt === "string" ? props.alt : ""}
      />
    );
  },
}));

// Mock PokemonSprite directly to sidestep the dependency chain.
vi.mock("@/components/pokemon-sprite", () => ({
  PokemonSprite: (props: { species: string }) => (
    <span data-testid="sprite" data-species={props.species}>
      {props.species}
    </span>
  ),
}));

// ReactMarkdown renders its children in jsdom OK — just ensure the
// module is loadable. remark-gfm should not need any special handling.

import { PokemonCardRenderer } from "../PokemonCardRenderer";

beforeAll(() => {
  // No-op — placeholder so we can add init if needed.
});

const canonical = `## Overview

Found 1 team.

## Teams

### Wolfe Glick — Spicy Spray Burn Wall
- **Source**: search_meta_teams (creator entry)
- **URL**: https://www.youtube.com/watch?v=nADGfhosH70
- **Team**: Scovillain / Primarina / Sneasler / Kingambit / Aerodactyl / Garchomp
- **Core tech**: The centerpiece is Scovillain + Primarina.

### QuantumSlack — Sun offense
- **Source**: search_meta_teams (limitless entry)
- **URL**: https://play.limitlesstcg.com/tournament/abc
- **Team**: Kingambit / Incineroar / Aerodactyl / Sneasler / Charizard / Floette
- **Core tech**: Charizardite Y gives sun.`;

const looseColon = `## Teams

### Wolfe Glick — Spicy Spray Burn Wall
Source: search_meta_teams (creator entry)
URL: https://www.youtube.com/watch?v=nADGfhosH70
Team: Scovillain, Primarina, Sneasler, Kingambit, Aerodactyl, Garchomp
Core tech: The centerpiece is Scovillain + Primarina.`;

const bareLabels = `## Overview

I cited sources.

1) Wolfe Glick
Source: Verified creator reveal
Record: Mega Scovillain Ladder Team — #1 Ranked Champions
URL: https://www.youtube.com/watch?v=nADGfhosH70
Team
Scovillain
Primarina
Sneasler
Kingambit
Aerodactyl
Garchomp
Core tech
The centerpiece is Scovillain + Primarina.`;

// Pokepaste-style build output — "Species @ Item" on one line,
// then Ability / Moves fields under it, no ### headers. Captured
// from a live GPT-5.4 team-build response.
const pokepasteStyleBuild = `Here's a solid 6-Pokémon starting team.

Cooklediaw @ Leftovers
Ability: Guts
Moves: Drain Punch / Mach Punch / Knock Off / Protect

Minskyaw @ Mental Herb
Ability: Disguise
Moves: Trick Room / Will-O-Wisp / Play Rough / Protect

Scovillain-Mega @ Scovillainite
Ability: Spicy Spray
Moves: Rage Powder / Leech Seed / Flamethrower / Protect

Primarina @ Leftovers
Ability: Liquid Voice
Moves: Hyper Voice / Moonblast / Calm Mind / Protect

Kingambit @ Black Glasses
Ability: Defiant
Moves: Kowtow Cleave / Sucker Punch / Swords Dance / Protect

Furigiraf @ Safety Goggles
Ability: Armor Tail
Moves: Trick Room / Foul Play / Helping Hand / Protect`;

// Exact drift pattern captured from GPT-5.4 live output:
// **Label:** (colon INSIDE the asterisks), "Link" instead of "URL",
// accented "Pokémon" as the team header, bullet list underneath.
const gpt54Drift = `## Wolfe Glick

### Wolfe Glick — Mega Scovillain Ladder Team — #1 Ranked Champions
**Source:** creator-verified team entry
**Link:** https://www.youtube.com/watch?v=nADGfhosH70

**Pokémon:**
- Scovillain
- Primarina
- Sneasler
- Kingambit
- Aerodactyl
- Garchomp

**Core tech:**
The centerpiece is Scovillain + Primarina. Wolfe's line is Rage Powder + burn.`;

const liveScreenshotDrift = `## Overview

I pulled the most grounded sources available: a verified creator team reveal for Wolfe Glick, plus recent high-placing Reg M-A tournament teams from Limitless.

---

## Wolfe Glick
**Source:** Verified team reveal  
**Record:** “Mega Scovillain Ladder Team — #1 Ranked Champions”  
**URL:** https://www.youtube.com/watch?v=nADGfhosH70

**Team**
- Scovillain
- Primarina
- Sneasler
- Kingambit
- Aerodactyl
- Garchomp

**Imported set list from source**
- **Scovillain** @ Scovillainite  
  Ability: Spicy Spray  
  Nature: Calm  
  Moves: Flamethrower / Leech Seed / Rage Powder / Protect
- **Primarina** @ Leftovers  
  Ability: Liquid Voice  
  Nature: Modest  
  Moves: Hyper Voice / Moonblast / Calm Mind / Protect

**Core tech**
- The team is built around **Scovillain + Primarina**.
- Aerodactyl gives the team Tailwind and Wide Guard support.`;

const looseBulletSummary = `What top Reg M-A players are converging on
Recent top-cut usage data supports these teams as representative of the current high-level metagame:

Sneasler — 53.64%
Incineroar — 45.76%
Garchomp — 43.03%
Basculegion — 30.3%
Kingambit — 28.79%
Sinistcha — 28.48%
Aerodactyl — 18.48%
Charizard / weather shells / Trick Room cores all remain relevant

Metagame takeaway
The strongest current trends among top Reg M-A players are:

Sneasler as the premier tempo attacker
Incineroar as universal glue
Garchomp as a default Ground-type pressure piece
Flexible weather rather than fully linear weather spam
Redundant speed control, especially Tailwind or double Trick Room structures
Mixed offense that prevents opponents from walling one damage axis`;

const megaStoneVariantDrift = `## Teams

### Showcase Player — Mega variants
- **Source**: search_meta_teams (creator entry)
- **URL**: https://example.com/team
- **Team**: Charizard / Scovillain / Kingambit

**Imported set list from source**
- **Charizard** @ Charizardite Y  
  Ability: Solar Power  
  Moves: Heat Wave / Protect / Weather Ball / Solar Beam
- **Scovillain** @ Scovillainite  
  Ability: Spicy Spray  
  Moves: Flamethrower / Rage Powder / Leech Seed / Protect
- **Kingambit** @ Black Glasses  
  Ability: Defiant  
  Moves: Kowtow Cleave / Sucker Punch / Protect / Iron Head

- **Core tech**: Mega forms should render in the team row.`;

const numberedResearchDrift = `## Overview

I pulled from the most grounded sources available:
- **Verified creator reveal** for Wolfe Glick
- **Recent Limitless tournament placements** for other top-performing Reg M-A players

Below are current teams that are either directly revealed by the player or attached to a recent high finish, plus the core tech that makes each team work.

---

## 1) Wolfe Glick — “Mega Scovillain Ladder Team — #1 Ranked Champions”
- **Source type**: Verified creator reveal
- **Source**: Wolfe Glick, *Mega Scovillain Ladder Team — #1 Ranked Champions*  
  https://www.youtube.com/watch?v=nADGfhosH70
- **Team**:
  - Scovillain
  - Primarina
  - Sneasler
  - Kingambit
  - Aerodactyl
  - Garchomp

**Core tech**
- The centerpiece is **Scovillain + Primarina**.
- Wolfe’s revealed gameplan is:
  - **Turn 1**: Scovillain uses **Rage Powder**, Primarina uses **Calm Mind**
  - Contact into Scovillain gets punished by its custom mechanic
- The backup mode is **Sneasler + Kingambit**.`;

const screenshot233439Drift = `## Current Reg M-A teams from Wolfe Glick and other top players

I used the most grounded sources available here:
- **Verified creator reveal** for Wolfe Glick
- **Recent Limitless tournament placements** for other top-performing Reg M-A players

For each player, I list the **full 6-Pokémon team**, the **source**, and the **core tech** that makes the team work.

---

### 1) Wolfe Glick
**Source:** Verified creator team reveal — “Mega Scovillain Ladder Team — #1 Ranked Champions”  
**Link:** https://www.youtube.com/watch?v=nADGfhosH70

**Team (6):**
- Scovillain
- Primarina
- Sneasler
- Kingambit
- Aerodactyl
- Garchomp

**Core tech:**
This is a ladder-optimized balance/offense team built around **Scovillain + Primarina**. The key line is:
- **Turn 1:** Scovillain uses **Rage Powder**
- Primarina uses **Calm Mind**
- If the opponent makes contact into Scovillain, they get punished by the team’s burn/Attack-control interaction

From there, the team snowballs through:
- **Boosted Primarina** as a bulky special wincon
- **Sneasler + Coaching** to enable **Kingambit**
- **Aerodactyl Tailwind** for speed control
- **Garchomp** as a fast, consistent physical cleaner

What makes it work is that it has **multiple win paths**: setup Primarina, boosted Kingambit, or standard Tailwind offense.`;

describe("PokemonCardRenderer — research cards", () => {
  it("renders two ResearchTeamCards for canonical format", () => {
    render(<PokemonCardRenderer content={canonical} />);
    expect(screen.getByText("Wolfe Glick")).toBeInTheDocument();
    expect(screen.getByText("QuantumSlack")).toBeInTheDocument();
    expect(screen.getByText(/Spicy Spray Burn Wall/)).toBeInTheDocument();
    // Species sprites
    const sprites = screen.getAllByTestId("sprite");
    expect(sprites.length).toBe(12); // 6 per team × 2 teams
  });

  it("renders a ResearchTeamCard for loose-colon format", () => {
    render(<PokemonCardRenderer content={looseColon} />);
    expect(screen.getByText("Wolfe Glick")).toBeInTheDocument();
    const sprites = screen.getAllByTestId("sprite");
    expect(sprites.length).toBe(6);
  });

  it("renders a ResearchTeamCard for bare-label format", () => {
    render(<PokemonCardRenderer content={bareLabels} />);
    expect(screen.getByText("Wolfe Glick")).toBeInTheDocument();
    const sprites = screen.getAllByTestId("sprite");
    expect(sprites.length).toBe(6);
  });

  it("renders a ResearchTeamCard for GPT-5.4 drift format (**Pokémon:** + Link + bullet list)", () => {
    render(<PokemonCardRenderer content={gpt54Drift} />);
    // "Wolfe Glick" appears twice — once as h2, once as card header.
    expect(screen.getAllByText("Wolfe Glick").length).toBeGreaterThanOrEqual(1);
    // Subtitle should be the archetype (first em-dash split)
    expect(
      screen.getByText(/Mega Scovillain Ladder Team/),
    ).toBeInTheDocument();
    // All 6 sprites must render — this is the critical regression
    // check: the drift used to fail parser and render species as
    // plain text instead of sprites.
    const sprites = screen.getAllByTestId("sprite");
    expect(sprites.length).toBe(6);
    // URL should have been extracted (via "Link" alias)
    expect(screen.getByText(/youtube\.com/)).toBeInTheDocument();
  });

  it("keeps live research cards intact when bold field labels are standalone lines", () => {
    render(<PokemonCardRenderer content={liveScreenshotDrift} />);
    expect(screen.getAllByText("Wolfe Glick").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Mega Scovillain Ladder Team/)).toBeInTheDocument();
    expect(screen.getAllByTestId("sprite")).toHaveLength(6);
    expect(screen.getByText("Mega Scovillain")).toBeInTheDocument();
    expect(screen.getAllByText(/^creator$/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Imported set list from source/i)).not.toBeInTheDocument();
  });

  it("normalizes loose summary lines into real markdown bullets", () => {
    render(<PokemonCardRenderer content={looseBulletSummary} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(14);
    expect(screen.getByText(/Sneasler — 53\.64%/)).toBeInTheDocument();
    expect(
      screen.getByText(/Mixed offense that prevents opponents from walling one damage axis/),
    ).toBeInTheDocument();
  });

  it("shows Mega forms in research team rows when imported sets reveal Mega Stones", () => {
    render(<PokemonCardRenderer content={megaStoneVariantDrift} />);
    expect(screen.getByText("Mega Charizard Y")).toBeInTheDocument();
    expect(screen.getByText("Mega Scovillain")).toBeInTheDocument();
    expect(screen.getAllByText(/^Kingambit$/).length).toBeGreaterThan(0);
  });

  it("parses numbered research sections with '- **Team**:' into visible team rows and lists", () => {
    render(<PokemonCardRenderer content={numberedResearchDrift} />);
    expect(screen.getByText("Wolfe Glick")).toBeInTheDocument();
    expect(screen.queryByText(/^1\) Wolfe Glick$/)).not.toBeInTheDocument();
    expect(screen.getAllByTestId("sprite")).toHaveLength(6);
    expect(screen.getByText(/youtube\.com/)).toBeInTheDocument();
    expect(screen.getByText(/Turn 1/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(4);
  });

  it("parses the current screenshot drift with '**Team (6):**' and visible bullet lists", () => {
    render(<PokemonCardRenderer content={screenshot233439Drift} />);
    expect(screen.getByText("Wolfe Glick")).toBeInTheDocument();
    expect(screen.getAllByTestId("sprite")).toHaveLength(6);
    expect(screen.getByText("Mega Scovillain")).toBeInTheDocument();
    expect(screen.getByText(/youtube\.com/)).toBeInTheDocument();
    expect(screen.getByText(/Turn 1:/)).toBeInTheDocument();
    expect(screen.getByText(/Boosted Primarina/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(9);
  });

  it("extracts source badges from mixed source strings", () => {
    render(<PokemonCardRenderer content={canonical} />);
    // Both teams should have badges derived from source strings.
    // "creator" appears in the first, "limitless" in the second.
    // Use getAllByText because "creator" shows up both in the badge
    // and in the raw source text.
    expect(screen.getAllByText(/creator/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/limitless/i).length).toBeGreaterThan(0);
  });

  it("renders Pokemon cards for Pokepaste-style 'Species @ Item' build output", () => {
    render(<PokemonCardRenderer content={pokepasteStyleBuild} />);
    // All 6 species should have rendered a card header — scan for
    // the species names (they appear as headings inside the cards).
    for (const name of [
      "Cooklediaw",
      "Minskyaw",
      "Scovillain-Mega",
      "Primarina",
      "Kingambit",
      "Furigiraf",
    ]) {
      expect(screen.getAllByText(new RegExp(name, "i")).length).toBeGreaterThan(0);
    }
    // Each card surfaces a sprite — 6 cards = 6 sprites.
    const sprites = screen.getAllByTestId("sprite");
    expect(sprites.length).toBeGreaterThanOrEqual(6);
  });

  it("merges '### N) Name' + '**Name @ Item**' + 'Moves:\\n- bullet' (screenshot + raw-md capture)", () => {
    const content = `## Full 6-Pokémon team

### 1) Conkeldurr
**Conkeldurr @ Leftovers**
Ability: **Guts**
Nature: **Brave**
EVs: **252 HP / 252 Atk / 4 SpD**
IVs: **0 Spe**
Moves:
- Drain Punch
- Facade
- Mach Punch
- Protect

### 2) Mimikyu
**Mimikyu @ Mental Herb**
Ability: **Disguise**
Nature: **Sassy**
Moves:
- Trick Room
- Will-O-Wisp
- Play Rough
- Protect`;

    render(<PokemonCardRenderer content={content} />);
    // 2 species → 2 cards → 2 sprites. NO duplicate card or stub h3.
    // (Sprite count is the reliable signal — the mock renders the
    // species name inside each sprite, which would inflate a raw
    // text count.)
    const sprites = screen.getAllByTestId("sprite");
    expect(sprites.length).toBe(2);
    // Items should have been absorbed from the **Species @ Item** line.
    expect(screen.getByText(/Leftovers/)).toBeInTheDocument();
    expect(screen.getByText(/Mental Herb/)).toBeInTheDocument();
    // Moves should be populated from the bulleted list under "Moves:".
    // They render as Badge components with the move name.
    expect(screen.getByText("Drain Punch")).toBeInTheDocument();
    expect(screen.getByText("Mach Punch")).toBeInTheDocument();
    expect(screen.getByText("Trick Room")).toBeInTheDocument();
    expect(screen.getByText("Will-O-Wisp")).toBeInTheDocument();
  });

  it("renders cards for Pokepaste-style build with intro + 'Team:' prose line (screenshot 060702)", () => {
    const content = `Here's a solid 6-Pokémon direction built around your idea:

Team: Trick Room balance
Cooklediaw @ Leftovers
Ability: Guts
Moves: Drain Punch / Mach Punch / Protect / Ice Punch
Role: A slow physical attacker. Minksyaw can burn it to activate Guts.

Minskyaw @ Mental Herb
Ability: Disguise
Moves: Trick Room / Will-O-Wisp / Play Rough / Protect
Role: Trick Room setter and self-burn support for Cooklediaw

Scovillain-Mega @ Scovillainite
Ability: Spicy Spray
Moves: Rage Powder / Leech Seed / Flamethrower / Protect
Role: redirection support so Minksyaw can try Trick Room

Primarina @ Leftovers
Ability: Liquid Voice
Moves: Hyper Voice / Moonblast / Calm Mind / Protect`;

    render(<PokemonCardRenderer content={content} />);
    // 4 species, 4 cards, 4 sprites.
    const sprites = screen.getAllByTestId("sprite");
    expect(sprites.length).toBe(4);
    const seen = sprites.map((s) => s.getAttribute("data-species"));
    expect(seen).toEqual(
      expect.arrayContaining([
        "Cooklediaw",
        "Minskyaw",
        expect.stringMatching(/Scovillain/),
        "Primarina",
      ]),
    );
  });
});

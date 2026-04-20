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

  it("extracts source badges from mixed source strings", () => {
    render(<PokemonCardRenderer content={canonical} />);
    // Both teams should have badges derived from source strings.
    // "creator" appears in the first, "limitless" in the second.
    // Use getAllByText because "creator" shows up both in the badge
    // and in the raw source text.
    expect(screen.getAllByText(/creator/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/limitless/i).length).toBeGreaterThan(0);
  });
});

"use client";

import { useState } from "react";

/**
 * Strip the "mega" token (prefix, suffix, or embedded) from a species
 * id and return the base species id. Used for the fallback when a Mega
 * sprite doesn't exist on Showdown — we want `floette-eternal.gif`, not
 * `floette-mega.gif` retried forever.
 */
function stripMegaToken(id: string): string {
  return id
    .replace(/^mega-?/, "")
    .replace(/-mega(-[xy])?$/i, "")
    .replace(/\(mega\)/i, "")
    .replace(/-+$/, "")
    .trim();
}

function getSpriteUrl(species: string, options: { mega?: boolean; forceBase?: boolean } = {}): string {
  if (!species) return "";
  let id = species
    .toLowerCase()
    .replace(/[''.]/g, "")
    .replace(/\s+/g, "")
    .trim();

  const wantsMega =
    !options.forceBase && (options.mega === true || id.includes("mega"));

  if (options.forceBase) {
    id = stripMegaToken(id);
  } else if (wantsMega) {
    // Strip "mega" prefix/suffix and reconstruct canonical form so
    // Showdown can resolve the sprite.
    const cleaned = stripMegaToken(id);

    // Check for X/Y forms (charizard-mega-x → charizardmegax)
    const xyMatch = species.match(/[- ]([xy])$/i);
    if (xyMatch) {
      const base = cleaned.replace(/-?[xy]$/i, "").trim();
      id = `${base}-mega${xyMatch[1].toLowerCase()}`;
    } else {
      id = `${cleaned}-mega`;
    }
  }

  // Clean any remaining non-alphanumeric chars except hyphens
  id = id.replace(/[^a-z0-9-]/g, "");

  return `https://play.pokemonshowdown.com/sprites/ani/${id}.gif`;
}

export function PokemonSprite({
  species,
  mega,
  size = 80,
  className,
}: {
  species: string;
  mega?: boolean;
  size?: number;
  className?: string;
}) {
  // Tracks the mega URL that 404'd, so we can flag "no official Mega art".
  // Keyed by the URL itself, so changing species/mega auto-resets the flag.
  const [erroredMegaUrl, setErroredMegaUrl] = useState<string | null>(null);

  if (!species) return null;
  const megaUrl = getSpriteUrl(species, { mega });
  const baseUrl = getSpriteUrl(species, { forceBase: true });
  const isMega = mega === true || species.toLowerCase().includes("mega");
  // Invented Champions megas have no Showdown sprite — once the mega gif
  // fails and we fall back to the base form, say so instead of silently
  // showing the base sprite under a "Mega" label.
  const noMegaArt =
    isMega && megaUrl !== baseUrl && erroredMegaUrl === megaUrl;

  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "inline-flex",
        width: size,
        height: size,
      }}
    >
      <img
        src={megaUrl}
        alt={species}
        width={size}
        height={size}
        style={{
          imageRendering: "pixelated",
          objectFit: "contain",
          width: "100%",
          height: "100%",
        }}
        onError={(e) => {
          const target = e.currentTarget;
          // Mega sprite failed (common for Champions-only Megas like
          // Eelektross-Mega that Showdown never had). Fall back to the base
          // species sprite so the user still sees something.
          if (target.src !== baseUrl) {
            target.src = baseUrl;
            if (isMega) setErroredMegaUrl(megaUrl);
          } else {
            target.style.display = "none";
          }
        }}
      />
      {noMegaArt && size >= 36 && (
        <span
          title="No official Mega sprite — showing base form"
          aria-label="No official Mega sprite; showing base form"
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            transform: "translate(10%, 10%)",
            fontSize: 9,
            lineHeight: "12px",
            padding: "0 3px",
            borderRadius: 4,
            background: "rgba(0,0,0,0.78)",
            border: "1px solid rgba(251,191,36,0.5)",
            color: "#fbbf24",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          base
        </span>
      )}
    </span>
  );
}

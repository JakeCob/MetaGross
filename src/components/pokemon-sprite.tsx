"use client";

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
  if (!species) return null;
  const megaUrl = getSpriteUrl(species, { mega });
  const baseUrl = getSpriteUrl(species, { forceBase: true });
  return (
    <img
      src={megaUrl}
      alt={species}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: "pixelated", objectFit: "contain" }}
      onError={(e) => {
        const target = e.currentTarget;
        // Mega sprite failed (common for Champions-only Megas like
        // Floette-Mega that Showdown never had). Fall back to the base
        // species sprite so the user still sees something.
        if (target.src !== baseUrl) {
          target.src = baseUrl;
        } else {
          target.style.display = "none";
        }
      }}
    />
  );
}

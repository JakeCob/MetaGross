"use client";

function getSpriteUrl(species: string, mega?: boolean): string {
  if (!species) return "";
  let id = species
    .toLowerCase()
    .replace(/[''.]/g, "")
    .replace(/\s+/g, "")
    .trim();

  // Handle mega forms
  // Input patterns: "Mega Dragonite", "Dragonite (Mega)", "Charizard-Mega-X", "Mega Charizard Y"
  if (mega || id.includes("mega")) {
    // Strip "mega" prefix/suffix and reconstruct
    const cleaned = id
      .replace(/^mega/, "")
      .replace(/\(mega\)/, "")
      .replace(/-mega$/, "")
      .replace(/mega-?/, "")
      .trim()
      .replace(/-+$/, "");

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
  const url = getSpriteUrl(species, mega);
  return (
    <img
      src={url}
      alt={species}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: "pixelated", objectFit: "contain" }}
      onError={(e) => {
        // If mega sprite fails, try base sprite
        const target = e.currentTarget;
        const baseUrl = getSpriteUrl(species, false);
        if (target.src !== baseUrl) {
          target.src = baseUrl;
        } else {
          target.style.display = "none";
        }
      }}
    />
  );
}

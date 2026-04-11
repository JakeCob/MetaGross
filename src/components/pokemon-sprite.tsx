"use client";

function getSpriteUrl(species: string): string {
  if (!species) return "";
  const id = species
    .toLowerCase()
    .replace(/[''.]/g, "")
    .replace(/[^a-z0-9-]/g, "")
    .trim();
  return `https://play.pokemonshowdown.com/sprites/ani/${id}.gif`;
}

export function PokemonSprite({
  species,
  size = 80,
  className,
}: {
  species: string;
  size?: number;
  className?: string;
}) {
  if (!species) return null;
  const url = getSpriteUrl(species);
  return (
    <img
      src={url}
      alt={species}
      width={size}
      height={size}
      className={className}
      style={{ imageRendering: "pixelated" }}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

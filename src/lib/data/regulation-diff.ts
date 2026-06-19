/**
 * Factual regulation diff — the new species / megas / items a regulation adds
 * over the previous one. Pure: only the REGULATIONS data + @pkmn/dex lookups,
 * no AI / DB / network. Kept separate from the (server-only) AI analysis so it
 * stays unit-testable and its types can be imported by client components.
 */
import { getSpecies } from "@/lib/pokemon/species";
import { getItem } from "@/lib/pokemon/items";
import {
  REGULATIONS,
  getRegulation,
  getMegaAbility,
  ACTIVE_REGULATION_FORMAT_ID,
} from "@/lib/data/champions";

export interface MbSpeciesEntry {
  species: string;
  types: string[];
  abilities: string[];
  /** True when this species was banned in the previous regulation. */
  unbanned: boolean;
}

export interface MbMegaEntry {
  mega: string;
  baseSpecies: string;
  stone: string;
  ability: string | null;
  types: string[];
}

export interface MbItemEntry {
  item: string;
  status: "unbanned" | "new";
  isStone: boolean;
  /** In-game effect (shortDesc from the dex). */
  description: string;
  /** For Mega Stones: the Mega form it enables, e.g. "Mega Raichu X". */
  enables?: string;
  /** For Mega Stones: base species to show as the icon (stones have no item icon). */
  iconSpecies?: string;
}

export interface MbContentBreakdown {
  regulation: string;
  previous: string;
  newSpecies: MbSpeciesEntry[];
  newMegas: MbMegaEntry[];
  newItems: MbItemEntry[];
  counts: { species: number; megas: number; items: number };
}

function lc(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Compute the additive diff of `format` (default active = M-B) over the
 * previous regulation (M-A): new species, new megas (+ signature abilities),
 * and new / un-banned items.
 */
export function getMbContentBreakdown(
  format: string = ACTIVE_REGULATION_FORMAT_ID,
): MbContentBreakdown {
  const reg = getRegulation(format);
  const prev = REGULATIONS["m-a"];
  const prevSpecies = new Set(prev.pokemon.map(lc));
  const prevMegaKeys = new Set(Object.keys(prev.megas).map(lc));
  const prevItems = new Set(prev.itemsConfirmed.map(lc));
  const prevBanned = new Set(prev.itemsBanned.map(lc));
  const prevNotIn = new Set(prev.notInPokemon.map(lc));

  const newSpecies: MbSpeciesEntry[] = reg.pokemon
    .filter((s) => !prevSpecies.has(lc(s)))
    .map((species) => {
      const data = getSpecies(species);
      return {
        species,
        types: data?.types ?? [],
        abilities: data?.abilities ?? [],
        unbanned: prevNotIn.has(lc(species)),
      };
    });

  // Map each Mega Stone (lowercased) → the Mega form it enables + base species.
  const stoneToMega = new Map<string, string>();
  const stoneToBase = new Map<string, string>();
  for (const [mega, info] of Object.entries(reg.megas)) {
    const xy = mega.match(/-Mega-([XY])$/i);
    stoneToMega.set(
      lc(info.stone),
      xy ? `Mega ${info.baseSpecies} ${xy[1].toUpperCase()}` : `Mega ${info.baseSpecies}`,
    );
    stoneToBase.set(lc(info.stone), info.baseSpecies);
  }

  const newMegas: MbMegaEntry[] = Object.entries(reg.megas)
    .filter(([mega]) => !prevMegaKeys.has(lc(mega)))
    .map(([mega, info]) => ({
      mega,
      baseSpecies: info.baseSpecies,
      stone: info.stone,
      ability: getMegaAbility(mega),
      types: getSpecies(mega)?.types ?? [],
    }));

  const newItems: MbItemEntry[] = reg.itemsConfirmed
    .filter((i) => !prevItems.has(lc(i)))
    .map((item) => {
      const enables = stoneToMega.get(lc(item));
      return {
        item,
        status: prevBanned.has(lc(item)) ? "unbanned" : ("new" as const),
        isStone: Boolean(enables),
        description: enables
          ? `Mega Stone — Mega Evolves into ${enables}.`
          : (getItem(item)?.description ?? ""),
        enables,
        iconSpecies: stoneToBase.get(lc(item)),
      };
    });

  return {
    regulation: reg.label,
    previous: prev.label,
    newSpecies,
    newMegas,
    newItems,
    counts: {
      species: newSpecies.length,
      megas: newMegas.length,
      items: newItems.length,
    },
  };
}

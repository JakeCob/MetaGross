import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getSmogonAnalysis } from "@/lib/pokemon/smogon-analysis";
import { ACTIVE_REGULATION_LABEL } from "@/lib/data/champions";

/**
 * get_smogon_analysis
 *
 * Fetches a Pokemon's Smogon dex analysis — role overview, teambuilding
 * notes, example sets (moves/items/abilities/EVs), counters, and full
 * learnset. Distinct from get_meta_data (Pikalytics usage %) and
 * get_pokemon_tournament_detail (Limitless aggregate): Smogon gives
 * you competitive PROSE — why this Pokemon works, who it pairs with,
 * what counters it.
 *
 * Champions Reg M-A doesn't exist on Smogon, so the tool auto-picks
 * the closest VGC analysis (latest VGC Regulation > generic VGC >
 * Doubles). The strategy format is returned in strategyFormat so the
 * agent can caveat any advice that's reg-specific.
 */
export const getSmogonAnalysisTool = new DynamicStructuredTool({
  name: "get_smogon_analysis",
  description:
    `Fetch a Pokemon's Smogon competitive analysis — role overview, teambuilding notes, example sets with EVs, counters, and full learnset. Use this when the user asks about a Pokemon's competitive niche, role, synergies, or counters in depth (things Pikalytics usage % can't tell you). Smogon doesn't have ${ACTIVE_REGULATION_LABEL} writeups, so the tool auto-selects the closest VGC strategy — cite the strategyFormat it returns so the user knows which reg the analysis is from.`,
  schema: z.object({
    species: z
      .string()
      .describe("Species name, e.g. 'Incineroar', 'Urshifu-Rapid-Strike'."),
    preferFormat: z
      .string()
      .optional()
      .describe(
        "Optional format hint to pick a specific strategy (e.g. 'VGC25 Regulation I', 'VGC', 'Doubles'). Omit for auto-pick.",
      ),
  }),
  func: async ({ species, preferFormat }) => {
    const analysis = await getSmogonAnalysis(species, { preferFormat });
    if (!analysis) {
      return JSON.stringify({
        species,
        error: `No Smogon analysis found for ${species}. The species may not have a dedicated writeup on Smogon, or the dump-pokemon RPC is unreachable.`,
      });
    }

    // Cap each long field so one call doesn't balloon the model's
    // context. Full text is still available via sourceUrl.
    const cap = (s: string, n: number) =>
      s.length <= n ? s : s.slice(0, n) + "\n…[truncated — see sourceUrl for the full analysis]";

    return JSON.stringify({
      species: analysis.species,
      strategyFormat: analysis.strategyFormat,
      strategySelectedReason: analysis.strategySelectedReason,
      sourceUrl: analysis.sourceUrl,
      availableFormats: analysis.availableFormats,
      overview: cap(analysis.overview, 1500),
      comments: cap(analysis.comments, 4000),
      movesets: analysis.movesets.map((m) => ({
        name: m.name,
        abilities: m.abilities,
        items: m.items,
        teratypes: m.teratypes,
        natures: m.natures,
        moves:
          m.moveslots?.map((slot) => slot.map((opt) => opt.move).join(" / ")) ??
          [],
        evconfigs: m.evconfigs,
      })),
      learnsetSample: analysis.learnset.slice(0, 60),
      nextStep:
        `Smogon strategies are NOT written for ${ACTIVE_REGULATION_LABEL} specifically — the analysis above is from ` +
        analysis.strategyFormat +
        ". Cite sourceUrl when you quote specific matchups or counters so the user can verify.",
    });
  },
});

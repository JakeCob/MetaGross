import { calculateDamageTool } from "./read/calculate-damage";
import { checkSpeedTool } from "./read/check-speed";
import { checkTypeEffectivenessTool } from "./read/check-type-effectiveness";
import { getMatchContextTool } from "./read/get-match-context";
import { getTeamTool } from "./read/get-team";
import { getMetaDataTool } from "./read/get-meta-data";
import { getEvBenchmarksTool } from "./read/get-ev-benchmarks";
import { searchWebTool } from "./read/search-web";
import { lookupPokemonTool } from "./read/lookup-pokemon";
import { lookupMoveTool } from "./read/lookup-move";
import { getPokemonSetsTool } from "./read/get-pokemon-sets";

import { proposeMatchNoteTool } from "./write/propose-match-note";
import { proposeTeamNoteTool } from "./write/propose-team-note";
import { proposeTeamVariantTool } from "./write/propose-team-variant";
import { proposePokemonPatchTool } from "./write/propose-pokemon-patch";

// Read-only tools — safe to call without user approval
export const readTools = [
  calculateDamageTool,
  checkSpeedTool,
  checkTypeEffectivenessTool,
  getMatchContextTool,
  getTeamTool,
  getMetaDataTool,
  getEvBenchmarksTool,
  searchWebTool,
  lookupPokemonTool,
  lookupMoveTool,
  getPokemonSetsTool,
];

// Write tools — return proposals that require user approval before execution
export const writeTools = [
  proposeMatchNoteTool,
  proposeTeamNoteTool,
  proposeTeamVariantTool,
  proposePokemonPatchTool,
];

// All tools combined
export const allTools = [...readTools, ...writeTools];

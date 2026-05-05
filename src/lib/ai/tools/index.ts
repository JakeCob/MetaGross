import { calculateDamageTool } from "./read/calculate-damage";
import { checkSpeedTool } from "./read/check-speed";
import { checkTypeEffectivenessTool } from "./read/check-type-effectiveness";
import { getMatchContextTool } from "./read/get-match-context";
import { getTeamTool } from "./read/get-team";
import { getMetaDataTool } from "./read/get-meta-data";
import { getEvBenchmarksTool } from "./read/get-ev-benchmarks";
import { searchWebTool } from "./read/search-web";
import { fetchUrlTool } from "./read/fetch-url";
import { getSmogonAnalysisTool } from "./read/get-smogon-analysis";
import { lookupPokemonTool } from "./read/lookup-pokemon";
import { lookupMoveTool } from "./read/lookup-move";
import { getPokemonSetsTool } from "./read/get-pokemon-sets";
import { optimizeEVSpreadTool } from "./read/optimize-ev-spread";
import { fetchReferenceTool } from "./read/fetch-reference";
import { searchMetaTeamsTool } from "./read/search-meta-teams";
import {
  getTournamentTeamsTool,
  getPokemonTournamentDetailTool,
} from "./read/get-tournament-teams";
import { writeTeamReportTool } from "./read/write-team-report";
import { validateTeamBuildTool } from "./read/validate-team-build";
import { simulateVsTopTeamsTool } from "./read/simulate-vs-top-teams";
import { exportPokepasteTool } from "./read/export-pokepaste";

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
  fetchUrlTool,
  getSmogonAnalysisTool,
  lookupPokemonTool,
  lookupMoveTool,
  getPokemonSetsTool,
  optimizeEVSpreadTool,
  fetchReferenceTool,
  searchMetaTeamsTool,
  getTournamentTeamsTool,
  getPokemonTournamentDetailTool,
  validateTeamBuildTool,
  simulateVsTopTeamsTool,
  exportPokepasteTool,
  writeTeamReportTool,
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

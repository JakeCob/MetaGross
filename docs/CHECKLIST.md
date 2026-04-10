# Implementation Checklist

## Phase 0: Scaffolding & Infrastructure

### Project Init
- [ ] Create Next.js 15 project with TypeScript, Tailwind, ESLint, App Router
- [ ] Configure tsconfig.json (strict mode, path aliases)
- [ ] Configure vitest.config.ts
- [ ] Configure .prettierrc
- [ ] Create .env.local.example
- [ ] Create .gitignore (include .env.local, node_modules, .next, supabase/.temp)

### Supabase Setup
- [ ] Initialize Supabase project (`supabase init`)
- [ ] Create migration: 00001_initial_schema.sql (all 8 tables)
- [ ] Create seed.sql (sample team data)
- [ ] Implement server Supabase client (src/lib/supabase/server.ts)
- [ ] Implement browser Supabase client (src/lib/supabase/client.ts)
- [ ] Implement middleware client (src/lib/supabase/middleware.ts)
- [ ] Verify: `supabase start && supabase db reset` works

### Pokemon Data Layer
- [ ] Implement generations.ts (@pkmn/dex + @pkmn/data init)
- [ ] Implement species.ts (getSpecies, searchSpecies, getAllSpecies)
- [ ] Implement moves.ts (getMove, getMovesForSpecies)
- [ ] Implement items.ts (getItem, getAllItems)
- [ ] Implement abilities.ts (getAbility, getAbilitiesForSpecies)
- [ ] Implement types.ts (getTypeEffectiveness, getAllTypes)
- [ ] Implement sets.ts (pokepaste import/export)
- [ ] Implement stats.ts (calcStat for all stats)
- [ ] Write tests: species.test.ts
- [ ] Write tests: stats.test.ts
- [ ] Write tests: types.test.ts
- [ ] Verify: all tests pass

### TypeScript Types
- [ ] Create pokemon.ts (TeamPokemon, EVSpread, IVSpread)
- [ ] Create battle.ts (BattleMatch, Turn, TurnAction, FieldState)
- [ ] Create analysis.ts (MatchAnalysis, MoveGrade, WinProbability)
- [ ] Create ev.ts (EVPrediction, EVSuggestion, BenchmarkResult, MetaSpread)

### UI Primitives
- [ ] Create button.tsx
- [ ] Create input.tsx
- [ ] Create card.tsx
- [ ] Create select.tsx
- [ ] Create slider.tsx
- [ ] Create badge.tsx
- [ ] Create dialog.tsx
- [ ] Create tabs.tsx

### Page Stubs
- [ ] Create all page stubs (dashboard, teams, battles, strategy)
- [ ] Create all API route stubs
- [ ] Verify: `pnpm dev` starts, `pnpm build` succeeds, `pnpm test` passes

---

## Phase 1: Team Entry & Management

- [ ] Write tests: team validation (Zod schemas)
- [ ] Implement team validation (teamPokemonSchema, teamSchema)
- [ ] Write tests: team API routes
- [ ] Implement team API routes (CRUD)
- [ ] Implement SpeciesSearch component (autocomplete)
- [ ] Implement MoveSelector component (4-move picker)
- [ ] Implement EVEditor component (6-stat editor with validation)
- [ ] Implement PokemonForm component (single Pokemon editor)
- [ ] Implement TeamImport component (pokepaste textarea)
- [ ] Implement TeamCard component (team summary)
- [ ] Implement TeamList component (all teams)
- [ ] Implement teams pages (list, new, detail, edit)
- [ ] Implement active team toggle
- [ ] Verify: create, import, edit, delete teams end-to-end

---

## Phase 2A: Battle Logger Core

- [ ] Write tests: battle logger Zustand store
- [ ] Implement battle-logger.ts Zustand store (with persist)
- [ ] Write tests: match API routes
- [ ] Implement match API routes (CRUD)
- [ ] Implement NewBattleDialog (mode selector)
- [ ] Implement OpponentTeamEntry (OTS quick entry)
- [ ] Implement TeamPreview (select brought-4, leads)
- [ ] Implement BattleResult (win/loss selector)
- [ ] Implement QuickMatchLog (minimal log)
- [ ] Implement battles pages (list, new, detail)
- [ ] Verify: log match with team preview data, persists to Supabase

---

## Phase 2B: Turn-by-Turn Logger

- [ ] Write tests: turn state transitions
- [ ] Extend Zustand store (turns, field state, active Pokemon, HP tracking)
- [ ] Implement BattleField (2v2 display)
- [ ] Implement PokemonSlot (sprite, HP bar, status)
- [ ] Implement ActionMenu (moves, switch, Mega — mobile-optimized)
- [ ] Implement MoveAction (target selection)
- [ ] Implement DamageSlider (0-100% + KO)
- [ ] Implement SwitchAction (bench picker)
- [ ] Implement FieldStateBar (weather, terrain, Trick Room, screens)
- [ ] Implement TurnLog (scrollable turn history)
- [ ] Implement EndBattleButton
- [ ] Implement PostMatchEditor (after-the-fact turn entry)
- [ ] Verify: log 5-turn match in real-time mode, data persists offline

---

## Phase 2C: Match History & Stats

- [ ] Implement MatchList (paginated, server component)
- [ ] Implement MatchCard (summary card)
- [ ] Implement MatchFilters (result, Pokemon, date)
- [ ] Implement MatchDetail (full view with turns)
- [ ] Implement WinLossOverview (dashboard card)
- [ ] Implement RecentMatches (last 5)
- [ ] Implement stats utilities (calculateWinRate, groupByPeriod)
- [ ] Verify: match history filters work, dashboard shows correct stats

---

## Phase 3A: Rule-Based Analysis

- [ ] Write tests: damage calc (10+ known matchups)
- [ ] Implement damage-calc.ts (@pkmn/dmg wrapper, doubles support)
- [ ] Write tests: speed calc (incl. Trick Room, Tailwind)
- [ ] Implement speed-calc.ts
- [ ] Write tests: win probability (sanity checks)
- [ ] Implement win-prob.ts (heuristic-based)
- [ ] Write tests: move grading (known scenarios)
- [ ] Implement move-grade.ts
- [ ] Implement analyze-match.ts (orchestrator)
- [ ] Implement WinProbChart (Recharts line chart)
- [ ] Implement MoveGradeDisplay (color-coded badges)
- [ ] Implement TurnAnalysis (per-turn breakdown)
- [ ] Implement MatchSummary (overall quality score)
- [ ] Implement analysis page
- [ ] Verify: full analysis runs in < 3 seconds for 15-turn match

---

## Phase 3B: EV Intelligence

- [ ] Write tests: reverse-calc accuracy
- [ ] Implement meta-lookup.ts (Pikalytics + @pkmn/smogon)
- [ ] Implement reverse-calc.ts (damage observations → EV prediction)
- [ ] Implement benchmark.ts (survival/KO/speed benchmarks)
- [ ] Implement meta-threats.ts (top 20 meta Pokemon)
- [ ] Implement EVPredictionDisplay component
- [ ] Implement BenchmarkList component
- [ ] Implement MetaSpreadList component
- [ ] Implement EV-related API routes
- [ ] Integrate EV prediction into battle logger
- [ ] Integrate EV suggestions into team builder
- [ ] Verify: prediction confidence increases with more observations

---

## Phase 3C: AI Analysis + Strategy

- [ ] Implement Claude API client (src/lib/ai/client.ts)
- [ ] Write system prompts (match-analysis, pre-match, ev-optimizer)
- [ ] Write tests: prompt construction, response parsing (mocked API)
- [ ] Implement match analysis orchestrator (with caching)
- [ ] Implement pre-match strategy generator
- [ ] Implement AI EV optimizer
- [ ] Implement AIAnalysisCard component
- [ ] Implement PreMatchStrategy component
- [ ] Implement AISpreadSuggestion component
- [ ] Implement strategy page
- [ ] Verify: analysis cached, no duplicate API calls, cost < $0.05/match

---

## Phase 3D: Performance Dashboard

- [ ] Implement win-rate.ts (trends, rolling average)
- [ ] Implement pokemon-usage.ts (bring rate, win rate)
- [ ] Implement move-quality.ts (grade trends)
- [ ] Implement matchup-patterns.ts (archetype win rates)
- [ ] Implement WinRateLineChart (Recharts)
- [ ] Implement PokemonUsageTable (sortable)
- [ ] Implement MatchupHeatmap
- [ ] Implement MoveQualityChart
- [ ] Update dashboard page with all charts
- [ ] Verify: dashboard loads in < 2 seconds with 100+ matches

# Tech Debt Tracker

## Known Debt (Pre-Implementation)

### ~~TD-001: Permissive RLS Policies~~ — N/A
Switched from Supabase to local SQLite. No RLS needed for single-user MVP.

### TD-002: Hardcoded Default User ID
- **Status**: Active
- **Description**: MVP uses hardcoded UUID (`00000000-0000-0000-0000-000000000001`). All data owned by this user.
- **Resolution**: Add auth system when moving to multi-user.

### TD-003: No Showdown Replay Parsing
- **Status**: Active
- **Description**: Only manual entry supported. No Showdown replay auto-parsing.
- **Resolution**: Add `@pkmn/stats` replay parser post-MVP.

### TD-004: Heuristic Win Probability
- **Status**: Active
- **Description**: Win probability uses weighted heuristics, not Monte Carlo simulation.
- **Resolution**: Upgrade to `@pkmn/engine` (WASM) Monte Carlo post-MVP.

### TD-005: No Rate Limiting on API Routes
- **Status**: Active
- **Description**: No rate limiting. Acceptable for single-user, vulnerable for multi-user.
- **Resolution**: Add rate limiting before public launch.

### TD-006: Claude API Cost Not Capped
- **Status**: Active
- **Description**: No budget cap on Claude API usage (~$0.02-0.05 per analysis).
- **Resolution**: Add daily/monthly usage cap tracked in analysis_cache table.

### TD-007: No Data Export/Backup
- **Status**: Active
- **Description**: No feature to export match history or teams as JSON/CSV.
- **Resolution**: Add export endpoints post-MVP.

### TD-008: Hardcoded Meta Data
- **Status**: Active (was Champions Data Availability)
- **Description**: Meta threats and common spreads in `src/lib/ev/meta-lookup.ts` are hardcoded for top 10 Pokemon. No live data from Pikalytics or Smogon.
- **Resolution**: Integrate Pikalytics AI endpoints and @pkmn/smogon for live meta data.

## Debt Added During Implementation

### TD-009: Duplicate TYPE_COLORS Map
- **Phase**: 1 (Team Builder)
- **Description**: `TYPE_COLORS` defined identically in SpeciesSearch.tsx and PokemonForm.tsx.
- **Resolution**: Extract to `src/lib/pokemon/constants.ts`.

### TD-010: Index Keys in Dynamic Lists
- **Phase**: 2B (Turn Logger)
- **Description**: 22 instances of `key={i}` in lists where items can be reordered/removed. May cause React reconciliation bugs.
- **Resolution**: Use stable IDs (turn number, action ID) instead of array indices.

### TD-011: No ON DELETE CASCADE in Schema
- **Phase**: 0 (Schema)
- **Description**: Foreign key cascading handled manually in transaction code, not in DB constraints. Fragile if new related tables are added.
- **Resolution**: Add `ON DELETE CASCADE` to Drizzle schema foreign key definitions.

### TD-012: Incomplete Label-Input Association
- **Phase**: UI (shadcn migration)
- **Description**: Many `<Label>` components lack `htmlFor` attribute. Screen readers cannot associate labels with inputs.
- **Resolution**: Add `id` props to all form inputs and matching `htmlFor` to Labels.

### TD-013: No loading.tsx Route Streaming
- **Phase**: All
- **Description**: No `loading.tsx` files for route-level streaming indicators. Pages block until data is ready.
- **Resolution**: Add loading.tsx files for data-heavy routes (/battles, /teams, /dashboard).

## Resolved Debt

### ~~TD-RESOLVED-001: @pkmn Client Bundle Bloat~~
- **Fixed in**: Phase 4 (Review)
- **Was**: @pkmn/dex (52MB) shipped to client browsers via component imports.
- **Fix**: Moved all Pokemon data lookups behind `/api/pokemon/*` routes. Client components now use fetch().

### ~~TD-RESOLVED-002: N+1 Database Queries~~
- **Fixed in**: Phase 4 (Review)
- **Was**: `getAllTeams` and `getMatchById` had N+1 query patterns.
- **Fix**: Batch queries using `inArray()` — reduced to 2-3 queries total.

### ~~TD-RESOLVED-003: No Error Boundaries~~
- **Fixed in**: Phase 4 (Review)
- **Was**: Zero error.tsx files in the app.
- **Fix**: Added global error.tsx and battles/error.tsx.

### ~~TD-RESOLVED-004: Missing Input Validation~~
- **Fixed in**: Phase 4 (Review)
- **Was**: PUT /api/matches/[id] had zero validation. PUT /api/teams/[id] had partial bypass.
- **Fix**: Added Zod schemas for match updates, fixed team partial validation.

### ~~TD-RESOLVED-005: No Auto-Migration~~
- **Fixed in**: Phase 4 (Review)
- **Was**: Fresh clone created empty DB with no tables.
- **Fix**: `npm run dev` and `npm run build` now auto-run `drizzle-kit push`.

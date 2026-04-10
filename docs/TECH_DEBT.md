# Tech Debt Tracker

## Known Debt (Pre-Implementation)

### TD-001: Permissive RLS Policies
- **Phase**: 0 (Scaffolding)
- **Description**: All Supabase RLS policies use `USING (true)` for MVP single-user mode. Must be replaced with `auth.uid() = user_id` checks before multi-user launch.
- **Impact**: No data isolation between users if multi-user is enabled without updating policies.
- **Resolution**: Replace all RLS policies when implementing auth (post-MVP).

### TD-002: Hardcoded Default User ID
- **Phase**: 0 (Scaffolding)
- **Description**: MVP uses a hardcoded UUID (`00000000-0000-0000-0000-000000000001`) as the default user. All data is owned by this user.
- **Impact**: Must be refactored when adding auth. All existing data will need a migration to assign to real users.
- **Resolution**: Add Supabase Auth + migration script post-MVP.

### TD-003: No Showdown Replay Parsing
- **Phase**: MVP scope decision
- **Description**: MVP only supports manual entry (Switch players). Showdown replay auto-parsing deferred.
- **Impact**: Showdown players cannot import matches automatically.
- **Resolution**: Add `@pkmn/stats` replay parser in post-MVP.

### TD-004: Heuristic Win Probability (Not Simulation-Based)
- **Phase**: 3A (Analysis)
- **Description**: Win probability uses weighted heuristics (HP%, Pokemon count, type matchups, speed control, field state) instead of Monte Carlo battle simulation.
- **Impact**: Less accurate than full simulation, especially in complex endgame states.
- **Resolution**: Upgrade to `@pkmn/engine` (WASM) Monte Carlo simulation post-MVP.

### TD-005: No Rate Limiting on API Routes
- **Phase**: 0 (Scaffolding)
- **Description**: API routes have no rate limiting. Acceptable for single-user MVP.
- **Impact**: Vulnerable to abuse in multi-user deployment.
- **Resolution**: Add rate limiting middleware (e.g., `next-rate-limit` or Supabase edge functions) before public launch.

### TD-006: Claude API Cost Not Capped
- **Phase**: 3C (AI Analysis)
- **Description**: No budget cap on Claude API usage. Cost estimated at ~$0.02-0.05 per analysis.
- **Impact**: Runaway costs possible if analysis is triggered excessively.
- **Resolution**: Add daily/monthly usage cap tracked in `analysis_cache` table.

### TD-007: No Data Export/Backup
- **Phase**: MVP scope decision
- **Description**: No feature to export match history or teams as JSON/CSV.
- **Impact**: Data locked in Supabase; no portability.
- **Resolution**: Add export endpoints post-MVP.

### TD-008: Pokemon Champions Data Availability
- **Phase**: 0 (Scaffolding)
- **Description**: `@pkmn` packages may not yet fully support Pokemon Champions format. May need manual data patches.
- **Impact**: Some Pokemon, moves, or mechanics may be missing or incorrect.
- **Resolution**: Monitor `@pkmn` package updates; contribute patches upstream if needed.

---

## Debt Added During Implementation

_(Track new debt items here as they arise during development)_

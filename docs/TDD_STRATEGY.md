# TDD Strategy — MetaGross MVP

## Testing Framework

- **Runner**: Vitest (fast, ESM-native, Vite-compatible)
- **Component Testing**: React Testing Library + jsdom
- **API Testing**: Vitest with mocked Supabase client
- **Coverage Target**: 80%+ for `src/lib/` (engine, pokemon, ev, ai), 60%+ for components

## Testing Approach Per Layer

### 1. Pokemon Data Layer (`src/lib/pokemon/`)
**Strategy**: Unit tests verifying @pkmn wrapper correctness.

```
RED:  Write test → getSpecies('Metagross') returns { baseStats: { hp: 80, atk: 135, ... } }
GREEN: Implement wrapper calling @pkmn/data
REFACTOR: Ensure memoization, clean return types
```

**Key test cases**:
- `getSpecies()` returns correct base stats, types, abilities
- `searchSpecies('meta')` returns Metagross, Metapod, etc.
- `getMove()` returns power, type, category, priority
- `getMovesForSpecies()` returns only legal moves for the species
- `getTypeEffectiveness('fire', ['grass', 'steel'])` returns 4x
- `calcStat('atk', 135, 31, 252, 50, 'Adamant')` returns correct value
- `calcStat('hp', 80, 31, 252, 50, 'Adamant')` uses HP formula (different from other stats)

### 2. Validation (`src/lib/validation/`)
**Strategy**: Unit tests for Zod schemas with valid and invalid inputs.

**Key test cases**:
- Valid team (6 Pokemon, 4 moves each, EVs <= 510) passes
- EV total > 510 fails
- EV single stat > 252 fails
- Empty moves array fails
- Invalid species name fails
- Duplicate items across team fails (Item Clause)
- Duplicate species fails (Species Clause)

### 3. Battle Logger Store (`src/stores/`)
**Strategy**: Unit tests for Zustand state transitions.

**Key test cases**:
- Start battle → state transitions to teamPreview phase
- Select brought-4 → validates exactly 4 selected
- Select leads → validates exactly 2 from brought-4
- Add turn action → appends to current turn
- Record KO → marks Pokemon fainted, prompts switch
- End battle → finalizes match with result
- Persist → state survives page reload (localStorage mock)
- Reset → clears all battle state

### 4. Analysis Engine (`src/lib/engine/`)
**Strategy**: Unit tests with known Pokemon matchups and pre-calculated expected values.

**Key test cases**:
- **Damage calc**: 252 Atk Adamant Metagross Heavy Slam vs 0 HP / 0 Def Gardevoir → known damage range
- **Speed calc**: Jolly 252 Spe Metagross (base 70) vs Adamant 0 Spe Garchomp (base 102) → Garchomp faster
- **Speed calc with Trick Room**: Same matchup → Metagross moves first
- **Speed calc with Tailwind**: Same matchup → Metagross faster (140 effective)
- **Win probability**: 4 Pokemon vs 2 Pokemon, all healthy → probability > 70%
- **Win probability**: 2 Pokemon vs 4 Pokemon, user has type advantage → probability ~40-50%
- **Move grading**: KO available but player used Protect → grade as "mistake" or "blunder"
- **Move grading**: Protect when opponent is locked into a move targeting you → grade as "optimal"
- **Turning point**: Win prob swings from 60% to 35% → flagged as turning point

### 5. EV Intelligence (`src/lib/ev/`)
**Strategy**: Unit tests with known damage values and reverse-calculated EVs.

**Key test cases**:
- **Reverse-calc**: Known attacker (252 Atk Adamant Metagross) deals 45% to Garchomp → predict HP/Def range
- **Reverse-calc accuracy**: Multiple observations narrow prediction
- **Benchmark**: Metagross needs X HP / Y Def to survive 252 Atk Garchomp Earthquake → verify EV values
- **Meta lookup**: Returns cached data if fresh, fetches if expired

### 6. AI Integration (`src/lib/ai/`)
**Strategy**: Unit tests with mocked Claude API responses. Integration test with real API (skipped in CI).

**Key test cases**:
- Prompt construction includes all match data and rule-based analysis
- Response parsing handles structured JSON output correctly
- Caching: second call for same match returns cached result without API call
- Error handling: API timeout → graceful fallback message
- Cost tracking: input/output tokens recorded in analysis_cache

### 7. API Routes (`src/app/api/`)
**Strategy**: Integration tests with mocked Supabase client.

**Key test cases**:
- POST /api/teams → creates team with valid data, returns 201
- POST /api/teams → rejects invalid EV totals, returns 400
- GET /api/teams → returns user's teams
- POST /api/matches → creates match, returns 201
- GET /api/matches → returns paginated match list
- POST /api/analysis/[id] → triggers analysis, returns results

### 8. Components
**Strategy**: Render tests with React Testing Library. Focus on interactive components.

**Key test cases**:
- EVEditor: dragging slider updates EV value, total displayed correctly
- EVEditor: attempting to exceed 510 shows error
- SpeciesSearch: typing filters autocomplete results
- ActionMenu: tapping move shows target selection
- DamageSlider: slider value reflects in display
- TeamPreview: selecting 4 Pokemon enables "Start Battle" button

## TDD Cycle Rules

1. **RED**: Write the failing test FIRST. Test must fail for the right reason.
2. **GREEN**: Write MINIMAL code to make the test pass. No extras.
3. **REFACTOR**: Clean up without changing behavior. All tests still pass.
4. **Commit after each GREEN**: Small, atomic commits with passing tests.
5. **No skipping tests**: If a test is hard to write, that's a design signal.

## Test File Naming Convention

```
src/lib/pokemon/__tests__/species.test.ts
src/lib/engine/__tests__/damage-calc.test.ts
src/stores/__tests__/battle-logger.test.ts
src/components/battle-logger/__tests__/ActionMenu.test.tsx
src/app/api/teams/__tests__/route.test.ts
```

## Mocking Strategy

- **@pkmn packages**: Do NOT mock. Use real @pkmn/dex data — it's fast and deterministic.
- **Supabase**: Mock with `vi.mock()`. Use typed mock responses matching `database.types.ts`.
- **Claude API**: Mock with `vi.mock('@anthropic-ai/sdk')`. Use fixture JSON responses.
- **Zustand**: Use `create` from zustand directly in tests (no mocking needed).
- **localStorage**: Use jsdom's built-in localStorage (available in vitest jsdom environment).
- **fetch** (for Pikalytics): Mock with `vi.stubGlobal('fetch', mockFetch)`.

# Plan: Tournament/Ladder Modes, Player Profile & Background Job

Status: **planning** (Phase 1 in progress). Owner: Jacob. Format target: **Champions Reg M-B**.

## 0. Strategy

Team building should know whether it's for a **rank ladder** (closed sheet → surprise tech is an
edge, e.g. Choice Scarf + Final Gambit on a popular Mega Staraptor) or a **tournament** (open team
sheet → no surprise; better to **copy/reference proven teams** and refine the exact sets winners run).

The codebase already leans this way: a `meta_teams` table + daily-cron aggregator pulls proven teams
(`listMetaTeams(format, limit)`), the `matches` table already has a `mode` column + `archetypeSelf/Opponent`,
and the analytics functions exist (`calculateArchetypeMatchups`, `calculatePokemonUsage`). So this is
mostly **wiring + UX**, not building from scratch.

## 1. Sources (tournament mode)

| Source | Gives | Access | Trust | Status |
|---|---|---|---|---|
| **Limitless** (`limitless.ts`) | full movesets (no EVs), standings | integrated | 0.95 | ✅ |
| **Labmaus** (labmaus.net) | top tournament teams per regulation, each with player/placement/record/tournament + a **pokepaste link to the full set** | REST: `GET /api/top_teams?regulation=Regulation Set M-B&date_range=…&language=en`. Needs **lenient TLS** (incomplete cert chain) + an **`Origin` header** (else 403). | ~0.9 | ✅ **DONE** (`aggregator-labmaus.ts`) — wired into cron + POST; verified live (741 M-B teams) |
| **Victory Road** (`victoryroad.pro`) | the **`/champions-replica/`** page = curated, creator-credited proven *Champions* teams (player, record, 6 species via `gen9-champions/<sp>.png` sprites, rental code). SV rental pages are cartridge VGC, not Champions. | scrape the HTML table | ~0.9 | ✅ **DONE** (`aggregator-victoryroad.ts`) — wired into cron + POST; verified live |

### Phase 5 status
- ✅ **Victory Road** (`aggregator-victoryroad.ts`): DONE + verified live — `POST {source:"victoryroad"}` scraped + inserted **122 teams** (113 for M-B), with author / record / species / HOME rental code; they surface in the Browse view with a "Victory Road" badge. In the daily cron.
- ✅ **Labmaus** (`aggregator-labmaus.ts`): DONE + verified live — `POST {source:"labmaus"}` inserted **741 Reg M-B teams**, 0 errors, each with player/record/tournament + a **pokepaste link** (full set) as the source URL. Uses the `/api/top_teams` REST endpoint with the `regulation` filter (NB: Labmaus also tracks cartridge VGC — Miraidon/Lunala etc. — which we exclude by passing `Regulation Set M-B`). Fetch goes through a lenient `undici` `Agent({connect:{rejectUnauthorized:false}})` (incomplete cert chain) + an `Origin` header (the API 403s without it). In the daily cron + `source:"all"`.
- Registration done: `MetaTeamSource` += `victoryroad`/`labmaus`; aggregate route GET/POST; `MetaTeamBrowser` source badges.
| Pikalytics / VGCPastes | usage / paste dumps | in aggregator | varies | ✅ |

All sources flow through the existing **aggregator → `meta_teams` → `listMetaTeams`** path (daily cron
`/api/meta-teams/aggregate`, `vercel.json`). New sources = new adapters registered into the aggregate.

**Importability:** Limitless/Labmaus give species + item + ability + 4 moves + tera but **no EVs/nature**
→ imported as skeletons completed by the existing **EV-pass**.

## 2. Workstream A — Tournament vs Ladder modes

Mode threads through existing plumbing (Explore-verified line refs):
`TeamBuilder` mode toggle (beside the format `Select`) → `TeamDebatePanel` body `{seed, brief, format, mode}`
→ `TeamDebateOptions` + `TeamDebateState` (add `mode`) → agent prompts.

- **Tournament mode:** `meta-analyst` node also calls `listMetaTeams(format)` and surfaces top-cut teams
  (archetype/record/source) + the draft's overlap with proven lists; `propose` prompt biases to *start
  from / adapt a proven team* and **expect open-sheet counterplay**.
- **Ladder mode:** `propose` prompt *allows one unexpected tech*, de-emphasises open-sheet counterplay,
  weights coverage/creativity over tournament popularity.
- **Browse proven teams view** (Phase 1, highest weekend ROI): list `meta_teams` for M-B with archetype +
  record + source badge + link → **"Use / adapt this team"** → import skeleton → EV-pass → battle-ready.

Scope: S–M (mode plumbing S, prompt branches S, meta-analyst wiring S, Browse view + import M).

## 3. Workstream B — Player profile (fuller analytics)

Mostly aggregation of existing `src/lib/utils/stats.ts`:

| Signal | Feasible | Basis |
|---|---|---|
| Win-rate by archetype | ✅ | `calculateArchetypeMatchups` |
| Most-used Pokémon / cores | ✅ | `calculatePokemonUsage` + `team_pokemon` |
| Weak matchups | ⚠️ needs `archetypeOpponent` tagged | `matches` |
| Preferred archetypes (rain/snow) | ➕ new (store as preference) | `agent_memories` kind=preference, or a `player_profile` row |
| Opponent tendencies | ❌ gap | `opponentBrought` stored but not aggregated; archetype not auto-detected |

- Store preferences (likes rain/snow), auto-derive cores + win-rates, **feed into the builder** (bias toward
  preferred archetypes, flag statistically weak matchups; `meta-analyst` consumes the profile).
- Gap-closing (Phase 2): auto-detect opponent archetype by **reusing the `opponent-scouting` classifier**;
  aggregate `opponentBrought` into an opponent-meta view.

Scope: M (profile + preferences S–M; opponent auto-classify M).

## 4. Workstream C — Background job (DB-persist + poll)

Build is ~15–20 min; serverless caps at 300s. "Persist + poll" fixes the UI; *something* must advance the
job past 300s.

- **Phase 1 (local + any long-lived Node host):** `debate_runs` table (`id, userId, format, mode, seed/brief,
  status, phase, progressJson {transcript, evProgress, partial team}, error, timestamps`, modeled on
  `analysis_cache`). `POST /api/teams/debate/start` → insert `queued`, run `streamTeamDebate` as a background
  task persisting after each node + EV-batch; UI switches SSE → `GET …/runs/:id` polling.
- ✅ **Phase 2 (true serverless durability):** DONE — but NOT via the LangGraph checkpointer: its `SqliteSaver`
  needs a better-sqlite3 file handle, while the app's store is libSQL/Turso (async, and the only durable store on
  serverless). Instead a **custom resumable step-runner** (`stepper.ts`) reduces the debate to small idempotent
  STEPS (one graph node, or one EV batch); `runs.ts` persists the full State + a `next_step` cursor to
  `debate_runs` after EVERY step (added cols `state_json`, `next_step`). A run interrupted by a timeout/restart
  resumes exactly where it stopped: `resumeStaleRuns` (driven by a `*/5` cron at `/api/teams/debate/advance`)
  picks up any `running` row gone quiet >90s and advances it within a 240s budget; `POST /advance {id}` resumes
  one run on demand. Cancel is durable (status re-read each step). Verified live (per-step checkpoint persists,
  cancel works, guard refuses non-running) + stepper unit-tested (sequence, critic loop, EV batches, resume).

Scope: Phase 1 M, Phase 2 L.

## 5. Phasing

| Phase | Deliverable | Size | Weekend |
|---|---|---|---|
| **1** | **Browse + import proven teams** (Limitless first; Labmaus/VR adapters follow) | M | ✅ highest ROI |
| 2 | Tournament/ladder mode toggle + prompt branches + meta-analyst Limitless wiring | S–M | ✅ |
| 3 | Player profile: preferences + derived stats → bias builder | M | partial |
| 4 | Background job Phase 1 (persist + poll) | M | infra |
| 5 | Labmaus + Victory Road source adapters; opponent auto-classify; bg-job Phase 2 | L | ✅ done |

## 6. Open items

- **Labmaus**: confirm internal API vs HTML scrape + handle TLS cert chain (verify from a real env).
- **Victory Road**: bespoke per-event scraping; start with Rental Teams index.
- Ladder "surprise tech" aggressiveness (one off-meta slot vs free rein) — TBD.

## Sources
- [LabMaus](https://labmaus.net/), [Victory Road](https://victoryroad.pro/), [Pikalytics](https://www.pikalytics.com/), [Limitless](https://limitlesstcg.com/)

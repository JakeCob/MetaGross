# In-App Agent Framework — Plan (for review)

**Status:** PROPOSAL — not yet built. Drafted 2026-06-17.
**Goal:** Give MetaGross's in-app AI a per-component structure — a top-level
index ("CLAUDE.md" for the webapp agent), per-component **knowledge** docs,
scoped **tools**, and named **skills** — so the agent behaves like an expert
specific to whatever part of the app the user is in.

---

## 1. Current state (what exists today)

- **One conversational agent** (LangGraph) in `src/lib/ai/graph/`. Nodes:
  `load-context → retrieve-memory → agent → tool-executor / review-write →
  verify-response → validate-response → extract-memory`.
- **Context** is a single string `contextType`, only ever `"team"` (team
  builder) or `"match"` (battle pages). `load-context.ts` loads the matching
  DB row into `loadedContext`.
- **System prompt** is one monolith: `BASE_SYSTEM_PROMPT` + `ROSTER_CONTEXT`
  in `graph/nodes/agent.ts`. Same prompt regardless of where the user is.
- **Tools**: 22 read + 4 write in `src/lib/ai/tools/`, **all loaded for every
  request** (no scoping). No grouping by area.
- **Standalone AI flows** outside the chat agent: EV Debate
  (`lib/ai/ev-debate/`), Opponent Scouting (`lib/ai/opponent-scouting/`),
  Pre-Match Strategy (`lib/ai/pre-match.ts`), and the new Build-Around
  suggester (`lib/team-analysis/ai-suggestions.ts`).
- **Knowledge docs** already exist ad-hoc in `docs/agent-knowledge/`
  (champions roster/items/movepool, meta-teams, regulation-m-b). These are
  reference notes for *us*, NOT loaded into the agent at runtime.

**Gap:** no per-component knowledge, no tool scoping, no skill registry, no
top-level index. The agent is a generalist with a fixed prompt.

---

## 2. Target architecture — three layers + an index

```
docs/agent-knowledge/AGENT.md            ← top-level index (the "CLAUDE.md")
src/lib/ai/knowledge/<component>.ts       ← KNOWLEDGE: prompt context per area
src/lib/ai/tools/<component>/*            ← TOOLS: grouped + scoped per area
src/lib/ai/skills/<skill>.ts              ← SKILLS: named multi-step capabilities
src/lib/ai/registry.ts                    ← maps component → {knowledge, tools, skills}
```

- **Knowledge** = a focused system-prompt fragment per component (rules,
  conventions, gotchas, "how to help here"). Injected based on `contextType`.
- **Tools** = the existing registry, **regrouped by component** and exposed as
  per-component subsets so each context only sees relevant tools.
- **Skills** = named, parameterized capabilities the agent can invoke that may
  wrap a single tool OR orchestrate a sub-flow (e.g. EV Debate). This is where
  "build-around team", "optimize EVs", "scout opponent" live.
- **Registry** = one source of truth mapping each component key to its
  knowledge fragment, tool subset, and skills. The graph reads it.

### How it plugs into the existing graph (minimal change)
1. `registry.ts` defines `COMPONENTS[contextType] = { knowledge, tools, skills }`.
2. `load-context.ts` (or the `agent` node) looks up the component by
   `contextType` and attaches its `knowledge` string + tool subset to state.
3. `agent.ts` assembles the prompt as
   `BASE_SYSTEM_PROMPT + ROSTER_CONTEXT + componentKnowledge + loadedContext`,
   and binds `componentTools` instead of `allTools`.
4. Unknown/with no `contextType` → a `default` component (current behaviour:
   all tools + a general knowledge doc). **Back-compatible.**

---

## 3. Component inventory (proposed mapping)

| Component | contextType | Knowledge doc | Tool subset (read) | Skills |
|---|---|---|---|---|
| **Team Builder** | `team` | `team-builder.ts` | validate_team_build, get_pokemon_competitive_sets, search_meta_teams, get_tournament_teams, simulate_vs_top_teams, get_meta_data, get_ev_benchmarks, optimize_ev_spread, lookup_pokemon/move, check_type_effectiveness, export_pokepaste, write_team_report | **build_around_team** (new), optimize_spread, team_report; writes: propose_pokemon_patch, propose_team_variant, propose_team_note |
| **Battle Logger** | `match` | `battle-logger.ts` | get_match_context, calculate_damage, check_speed, check_type_effectiveness, lookup_pokemon/move, get_meta_data, search_web | post_match_analysis; write: propose_match_note |
| **EV Intelligence** | `ev` *(new ctx)* | `ev.ts` | optimize_ev_spread, get_ev_benchmarks, calculate_damage, check_speed | **ev_debate** (Wolfe/Cybertron) |
| **Meta** | `meta` *(new ctx)* | `meta.ts` | get_meta_data, search_meta_teams, get_tournament_teams, get_pokemon_competitive_sets, get_smogon_analysis | meta_report |
| **Strategy** | `strategy` *(new ctx)* | `strategy.ts` | get_match_context, simulate_vs_top_teams, get_meta_data, get_tournament_teams | **pre_match_strategy** |
| **Scouting** | `scouting` *(new ctx)* | `scouting.ts` | search_web, fetch_url, fetch_reference, get_pokemon_competitive_sets, search_meta_teams | **scout_opponent** |
| **default / global** | (none) | `global.ts` | all read tools | all skills |

> Champions/Dashboard/Team-Archive are mostly read-only UI; they inherit
> `default` unless we later add chat surfaces there.

---

## 4. Key mechanism decisions

**(a) Knowledge format — `.ts` string modules (recommended).** Author each
component's knowledge as an exported string in `src/lib/ai/knowledge/*.ts`.
Bundler-safe (no runtime `fs`), type-checked, unit-testable, and can
interpolate live data (e.g. `ACTIVE_REGULATION_LABEL`, `CHAMPIONS_POKEMON`).
*Alternative:* author in `docs/agent-knowledge/components/*.md` and load at
runtime — nicer to edit, but needs a loader and risks bundling/edge issues.
**Recommendation:** `.ts` source of truth; keep a short human-facing `.md`
index in `AGENT.md`.

**(b) Tool scoping — per-component subsets (recommended).** Fewer, relevant
tools per context measurably improves tool-selection quality and lowers
token cost. Risk: a context missing a tool it occasionally needs — mitigated
by a generous subset + always including a small "core" set (lookup_pokemon,
lookup_move, get_meta_data, search_web).

**(c) Skills.** A `Skill` = `{ name, description, component, run() }`. Some wrap
one tool; others orchestrate a sub-graph (EV Debate, Scouting). The
build-around suggester becomes the first real skill + a callable agent tool
(`suggest_teammates`) so the chat copilot can invoke it, not just the panel.

**(d) Expanding the chat agent to new contexts.** Today only team/match invoke
the chat agent. Adding `ev/meta/strategy/scouting` contexts means wiring those
pages' chat entry points to pass the new `contextType`. We can do this
incrementally — the registry supports a context before any page uses it.

---

## 5. Decisions I need from you

1. **Knowledge format:** `.ts` modules (recommended) or human-authored `.md`
   loaded at runtime?
2. **Tool scoping:** per-component subsets (recommended) or keep all tools
   loaded everywhere (simpler, current behaviour)?
3. **Scope of contexts now:** just formalize the existing `team` + `match`, or
   also stand up `ev/meta/strategy/scouting` contexts (and wire their pages)?
4. **Build-around as a tool:** convert `ai-suggestions` into a callable agent
   tool (`suggest_teammates`) as part of this, so the chat copilot can use it?

---

## 6. Phased rollout (BDD/TDD per the project workflow)

- **Phase A — Scaffolding (vertical slice).** Create `registry.ts`,
  `knowledge/global.ts` + `knowledge/team-builder.ts`, a `tools/team-builder`
  grouping, and wire `load-context`/`agent` to use the registry for
  `contextType="team"`. Prove the slice end-to-end in the team builder. Keep
  `default` = today's behaviour so nothing regresses.
- **Phase B — Battle Logger** (`match`) knowledge + tool subset.
- **Phase C — Skills layer**: `Skill` type + registry; convert build-around to
  `suggest_teammates` tool/skill; register EV Debate / Scouting / Pre-Match as
  skills.
- **Phase D — New contexts** (`ev/meta/strategy/scouting`) + wire their pages'
  chat entry points.
- **Phase E — AGENT.md index** + docs, knowledge-share, retro.

Each phase: RED tests first (registry resolves component → knowledge+tools;
unknown context → default), GREEN implement, then `tsc` + `vitest` + a live
browser check.

---

## 7. Testing & verification

- Unit: `registry` returns the right knowledge + tool set per `contextType`;
  unknown → `default`; every registered tool/skill exists.
- Unit: each knowledge fragment is non-empty and interpolates live data
  (e.g. contains the active regulation label).
- Integration/live: in the team builder, confirm the agent uses team-builder
  tools and references team-builder knowledge; battle pages use match tools.
- Gate every phase with `tsc --noEmit` + full `vitest` + a Playwright check.

---

## 8. Risks / tech debt

- **Tool scoping regressions** — a context might lose a tool it needed. Mitigate
  with the always-on "core" set + telemetry on tool-not-found.
- **Prompt bloat** — per-component knowledge must stay lean; cap each fragment.
- **Dual maintenance** if we keep both `.md` and `.ts` — pick one source.
- **Sub-flow coupling** — wrapping EV Debate / Scouting as skills must not
  duplicate their graphs; skills should call the existing entry points.

---

## 9. Effort estimate (rough)

- Phase A: ~½ day · B: ~¼ day · C: ~1 day (skills + build-around tool) ·
  D: ~½–1 day (depends how many pages get chat) · E: ~¼ day.
- **Recommend starting with Phase A as a vertical slice** to validate the
  registry pattern before expanding.

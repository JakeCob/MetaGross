@AGENTS.md

# MetaGross — Project Context for Claude Code

## Overview
AI-powered Pokemon VGC competitive intelligence platform. Battle logging, match analysis, team building, EV intelligence, and AI coaching.

## Tech Stack
- **Framework**: Next.js 16 (App Router), TypeScript (strict)
- **UI**: Tailwind CSS v4 + shadcn/ui (base-nova, dark mode always on)
- **Database**: SQLite (better-sqlite3) + Drizzle ORM
- **Pokemon Data**: @pkmn/dex, @pkmn/data, @pkmn/sets (SERVER-SIDE ONLY)
- **Damage Calc**: @smogon/calc (server-side)
- **AI**: Claude API (@anthropic-ai/sdk, claude-sonnet-4-5-20250929)
- **Charts**: Recharts
- **State**: Zustand (with persist middleware for battle logger)
- **Validation**: Zod v4
- **Testing**: Vitest + React Testing Library

## Critical Rules
1. **@pkmn packages are server-only** — Never import from `@/lib/pokemon/*` in client components. Use the `/api/pokemon/*` routes instead.
2. **Dark mode always on** — `<html>` has `dark` class. Use shadcn dark theme variables.
3. **Dynamic params are Promises** — In Next.js 16, `params` must be `await`ed in page/route components.
4. **Drizzle JSON columns** — `moves`, `evs`, `ivs`, team snapshots use `text({ mode: 'json' })`. Values may need parsing when read.
5. **Claude API is optional** — Always check `process.env.ANTHROPIC_API_KEY` before calling. Graceful fallback to rule-based analysis.

## Key Commands
```bash
npm run dev          # Auto-pushes DB schema + starts dev server
npm run build        # Auto-pushes DB schema + production build
npm run test         # Vitest
npm run db:push      # Apply Drizzle schema to SQLite
```

## Project Structure
```
src/
├── app/                 # Next.js App Router
│   ├── api/             # 16 API routes (teams, matches, analysis, ev-calc, pokemon, strategy)
│   ├── battles/         # Match logging + history + analysis
│   ├── dashboard/       # Performance dashboard with charts
│   ├── strategy/        # Pre-match strategy (Claude AI)
│   └── teams/           # Team builder + management
├── components/
│   ├── ui/              # shadcn/ui primitives (11 components)
│   ├── analysis/        # Win prob chart, move grades, match summary
│   ├── battle-logger/   # Battlefield, action menu, turn logging
│   ├── dashboard/       # Stats, charts, usage tables
│   ├── ev/              # EV prediction, benchmarks, spread comparison
│   ├── strategy/        # Pre-match strategy generator
│   └── team-builder/    # Species search, moves, EVs, team import
├── lib/
│   ├── ai/              # Claude API client + prompts (server-only)
│   ├── db/              # Drizzle schema, queries, seed data
│   ├── engine/          # Damage calc, speed calc, win prob, move grading, match analysis
│   ├── ev/              # Reverse-calc, benchmarks, meta lookup
│   ├── pokemon/         # @pkmn wrappers (server-only)
│   ├── types/           # Shared TypeScript interfaces
│   ├── utils/           # Stats calculations
│   └── validation/      # Zod schemas
├── stores/              # Zustand stores (battle logger)
└── test-setup.ts        # Vitest setup
```

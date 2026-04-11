# LangGraph Agent Implementation Plan

## Goal

Build a local-only, single-user agent copilot for MetaGross that:

- starts on the battle analysis page
- supports chat with streaming responses
- uses human approval before any write action
- persists agent threads and feedback over time
- learns from approvals, rejections, edits, and corrections by storing structured memory

This plan is for local personal use only. Do not optimize for public multi-user deployment in v1.

## Core Decision

Use LangGraph for backend orchestration because the product requirements now include:

- durable execution
- interrupt/resume workflows
- human-in-the-loop approval
- persistent thread state
- feedback-driven adaptation

Use Next.js App Router for the UI and route layer.
Use SQLite for both app data and local graph checkpointing.

## Non-Goals For V1

- public deployment
- multi-user auth
- filesystem-based primary memory
- autonomous background jobs
- multi-agent delegation
- replacing existing one-shot AI features

## Architectural Summary

Keep the current MetaGross app architecture intact:

- UI in `src/app` and `src/components`
- domain logic in `src/lib`
- persistence in Drizzle + SQLite
- validation in Zod

Add a new LangGraph-backed agent path in parallel with existing AI routes.

Do not remove or rewrite:

- `src/lib/ai/client.ts`
- existing `/api/analysis/*`
- existing `/api/strategy/*`
- existing `/api/ev-calc/*`

## New Dependencies

Install:

- `@langchain/langgraph`
- `@langchain/core`
- `@langchain/openai`
- `@langchain/anthropic`
- `@langchain/langgraph-checkpoint-sqlite`

Optional later:

- `@langchain/langgraph-sdk` for frontend helpers if needed

Keep existing `openai` and `@anthropic-ai/sdk` packages for legacy routes.

## Persistence Strategy

Use two persistence layers:

### 1. LangGraph Short-Term Thread Persistence

Use `@langchain/langgraph-checkpoint-sqlite` with a dedicated local SQLite file.

Suggested file:

- `metagross-agent-checkpoints.db`

Purpose:

- graph checkpoints
- thread resume
- interrupt state
- execution history

Do not use the checkpoint database as the primary app memory store.

### 2. Drizzle Long-Term Memory And Feedback

Store reusable memory and user feedback in the main app database.

Purpose:

- agent thread metadata
- feedback events
- distilled long-term memories
- generated artifacts

## Database Changes

Add these tables to `src/lib/db/schema.ts`.

### `agent_threads`

- `id`
- `title`
- `contextType` (`match`, `team`, `general`)
- `contextId`
- `provider`
- `model`
- `createdAt`
- `updatedAt`

### `agent_feedback_events`

- `id`
- `threadId`
- `messageId`
- `eventType` (`approve`, `reject`, `edit`, `correct`, `note`)
- `targetType` (`tool_call`, `answer`, `memory`, `write_action`)
- `payloadJson`
- `createdAt`

### `agent_memories`

- `id`
- `scope` (`global`, `team`, `matchup`, `thread`)
- `scopeRef`
- `kind` (`preference`, `strategy`, `correction`, `team_style`, `opponent_pattern`)
- `summary`
- `content`
- `confidence`
- `sourceFeedbackId`
- `createdAt`
- `updatedAt`

### `agent_artifacts`

- `id`
- `threadId`
- `artifactType` (`team_draft`, `battle_report`, `note_bundle`)
- `title`
- `contentJson`
- `createdAt`

## New Query Modules

Add:

- `src/lib/db/queries/agent-threads.ts`
- `src/lib/db/queries/agent-feedback.ts`
- `src/lib/db/queries/agent-memories.ts`
- `src/lib/db/queries/agent-artifacts.ts`

Keep the query style consistent with existing `src/lib/db/queries/*`.

## Agent State

Create:

- `src/lib/ai/graph/state.ts`

Suggested state fields:

- `messages`
- `threadId`
- `contextType`
- `contextId`
- `loadedContext`
- `memoryHits`
- `pendingAction`
- `toolResults`
- `feedbackSummary`
- `finalAnswer`

Keep state serializable and small.

## Graph Layout

Create:

- `src/lib/ai/graph/index.ts`
- `src/lib/ai/graph/nodes/*`

Suggested flow:

1. `load_context`
2. `retrieve_memory`
3. `plan`
4. `run_tools`
5. `review_for_write`
6. `execute_write`
7. `persist_feedback`
8. `synthesize_memory`
9. `respond`

### Node Responsibilities

#### `load_context`

Load relevant match, team, opponent, and analysis context using existing internal modules.

#### `retrieve_memory`

Fetch relevant memories from `agent_memories` based on thread, team, matchup, and global scope.

#### `plan`

Let the model decide whether it can answer directly, needs tools, or wants to propose a write action.

#### `run_tools`

Execute read-only tools only.

#### `review_for_write`

If a mutation is proposed, pause execution with a LangGraph interrupt.

#### `execute_write`

Only run after explicit user approval or edited approval payload.

#### `persist_feedback`

Store raw feedback events from the user.

#### `synthesize_memory`

Distill reusable memory from feedback, not from every message.

#### `respond`

Return the final assistant response.

## Human-In-The-Loop Rules

All write actions must use interrupt/resume.

Allowed outcomes:

- approve
- reject
- edit

Requirements:

- no non-idempotent writes before interrupt
- proposed actions must be structured
- user-visible summaries must explain what will change
- edited payloads must be revalidated before execution

## Tool Layer

Create:

- `src/lib/ai/tools/index.ts`
- `src/lib/ai/tools/read/*`
- `src/lib/ai/tools/write/*`

### Initial Read Tools

- `get_match_context`
- `get_rule_analysis`
- `get_team`
- `get_opponent_team`
- `search_meta`
- `get_ev_suggestions`
- `get_usage_summary`

These tools should call internal server-side modules directly, not your own HTTP routes.

### Initial Write Tools

- `propose_match_note_update`
- `propose_team_note_update`
- `propose_team_variant`
- `propose_team_pokemon_patch`

Write tools should generate structured proposals.
Actual DB mutation belongs in `execute_write` after approval.

## Feedback Learning Model

The agent does not fine-tune itself in v1.

Instead, it learns by storing structured feedback:

- approved actions
- rejected actions
- edited actions
- direct corrections
- explicit preferences

Examples of distilled memory:

- prefers aggressive lines into balance teams
- dislikes passive Incineroar pivot patterns
- values speed control highly in drafts
- prefers concise tactical explanations

Only store durable, reusable patterns.
Do not store every tool result as memory.

## New Types And Validation

Add:

- `src/lib/types/agent.ts`
- `src/lib/validation/agent.ts`

Define and validate:

- thread creation input
- chat message input
- interrupt payloads
- approval payloads
- edited action payloads
- memory record shapes

Use Zod for all new route inputs.

## API Surface

Add:

- `POST /api/agent`
- `GET /api/agent/[threadId]`
- `POST /api/agent/[threadId]/resume`

Optional later:

- `GET /api/agent/[threadId]/history`

### `POST /api/agent`

Responsibilities:

- create or continue a thread
- stream agent output
- run graph with the correct `thread_id`

### `GET /api/agent/[threadId]`

Responsibilities:

- load thread metadata
- load existing UI-visible message history

### `POST /api/agent/[threadId]/resume`

Responsibilities:

- resume an interrupted graph
- accept `approve`, `reject`, or `edit`
- validate resume payloads strictly

## UI Plan

Start integration on:

- `src/app/battles/[id]/analysis/AnalysisView.tsx`

Add:

- `src/components/agent/AgentPanel.tsx`
- `src/components/agent/AgentMessageList.tsx`
- `src/components/agent/AgentComposer.tsx`
- `src/components/agent/AgentApprovalCard.tsx`
- `src/components/agent/AgentToolTrace.tsx`

V1 UI requirements:

- streaming messages
- clear pending approval cards
- persistent thread per match
- optional collapsible tool trace
- simple local React state unless cross-route persistence becomes necessary

## Implementation Phases

### Phase 1

- install dependencies
- add checkpoint wiring
- add DB tables
- add query modules

### Phase 2

- add agent types
- add Zod validation
- add read tools

### Phase 3

- implement LangGraph state and nodes
- implement interrupt-based approval
- implement resume endpoint

### Phase 4

- add `AgentPanel` UI to match analysis page
- stream responses
- render approval cards

### Phase 5

- persist feedback events
- distill long-term memory
- retrieve relevant memory on future runs

### Phase 6

- expand to strategy page
- expand later to team builder flows

## Testing Plan

Add:

- `src/lib/validation/__tests__/agent.test.ts`
- `src/lib/ai/__tests__/tools.test.ts`
- `src/lib/ai/__tests__/approval-flow.test.ts`
- `src/lib/ai/__tests__/memory-distillation.test.ts`

Must cover:

- request validation
- interrupt payload shape
- approve path
- reject path
- edit path
- no write before approval
- checkpoint resume behavior
- memory creation from feedback
- memory retrieval for future runs

## Acceptance Criteria

V1 is complete when:

- a user can open a match analysis page and chat with the agent
- responses stream in the UI
- the agent can inspect match, team, opponent, and meta context via tools
- the agent can propose note and team changes
- no write occurs without approval
- a thread can be resumed after interruption
- feedback is stored and reused as memory
- existing one-shot AI routes still work

## Implementation Notes For Claude Code

- follow Next 16 bundled docs before making App Router changes
- keep `@pkmn/*` and battle logic server-only
- do not replace the existing AI routes
- use internal modules directly instead of self-calling HTTP routes
- keep long-term memory in Drizzle tables
- keep checkpoint state in a separate local SQLite database
- start with a single agent, not a multi-agent system

import { sqliteTable, text, integer, real, index, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').unique(),
  displayName: text('display_name'),
  createdAt: integer('created_at').$defaultFn(() => Date.now()),
  updatedAt: integer('updated_at').$defaultFn(() => Date.now()),
});

// ---------------------------------------------------------------------------
// teams
// ---------------------------------------------------------------------------
export const teams = sqliteTable(
  'teams',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .references(() => users.id)
      .default('00000000-0000-0000-0000-000000000001'),
    name: text('name').notNull(),
    format: text('format').default('champions-reg-m-a'),
    isActive: integer('is_active').default(0),
    pokepaste: text('pokepaste'),
    notes: text('notes'),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at').$defaultFn(() => Date.now()),
  },
  (table) => [
    index('teams_user_id_idx').on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// team_pokemon
// ---------------------------------------------------------------------------
export const teamPokemon = sqliteTable(
  'team_pokemon',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    teamId: text('team_id').references(() => teams.id),
    slot: integer('slot'), // 1-6
    species: text('species').notNull(),
    ability: text('ability').notNull(),
    item: text('item'),
    nature: text('nature').default('Hardy'),
    level: integer('level').default(50),
    megaEvolution: text('mega_evolution'),
    teraType: text('tera_type'),
    moves: text('moves', { mode: 'json' }).default('[]'),
    evs: text('evs', { mode: 'json' }).default(
      '{"hp":0,"atk":0,"def":0,"spa":0,"spd":0,"spe":0}',
    ),
    ivs: text('ivs', { mode: 'json' }).default(
      '{"hp":31,"atk":31,"def":31,"spa":31,"spd":31,"spe":31}',
    ),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
  },
  (table) => [
    index('team_pokemon_team_id_idx').on(table.teamId),
    index('team_pokemon_species_idx').on(table.species),
  ],
);

// ---------------------------------------------------------------------------
// matches
// ---------------------------------------------------------------------------
export const matches = sqliteTable(
  'matches',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .references(() => users.id)
      .default('00000000-0000-0000-0000-000000000001'),
    teamId: text('team_id').references(() => teams.id),
    format: text('format').default('champions-reg-m-a'),
    mode: text('mode'), // 'realtime' | 'postmatch' | 'quick'
    result: text('result'), // 'win' | 'loss'
    playedAt: integer('played_at'),
    notes: text('notes'),
    myTeam: text('my_team', { mode: 'json' }),
    opponentTeam: text('opponent_team', { mode: 'json' }),
    myBrought: text('my_brought', { mode: 'json' }).default('[]'),
    opponentBrought: text('opponent_brought', { mode: 'json' }).default('[]'),
    myLeads: text('my_leads', { mode: 'json' }).default('[]'),
    opponentLeads: text('opponent_leads', { mode: 'json' }).default('[]'),
    ruleAnalysisJson: text('rule_analysis_json', { mode: 'json' }),
    aiAnalysisJson: text('ai_analysis_json', { mode: 'json' }),
    analyzedAt: integer('analyzed_at'),
    opponentName: text('opponent_name'),
    archetypeSelf: text('archetype_self'),
    archetypeOpponent: text('archetype_opponent'),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at').$defaultFn(() => Date.now()),
  },
  (table) => [
    index('matches_user_id_idx').on(table.userId),
    index('matches_played_at_idx').on(table.playedAt),
  ],
);

// ---------------------------------------------------------------------------
// match_turns
// ---------------------------------------------------------------------------
export const matchTurns = sqliteTable(
  'match_turns',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    matchId: text('match_id').references(() => matches.id),
    turnNumber: integer('turn_number'),
    fieldState: text('field_state', { mode: 'json' }).default('{}'),
    activeP1: text('active_p1', { mode: 'json' }).default('[]'),
    activeP2: text('active_p2', { mode: 'json' }).default('[]'),
    winProbability: real('win_probability'),
    isTurningPoint: integer('is_turning_point').default(0),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
  },
  (table) => [
    index('match_turns_match_id_idx').on(table.matchId),
  ],
);

// ---------------------------------------------------------------------------
// match_turn_actions
// ---------------------------------------------------------------------------
export const matchTurnActions = sqliteTable(
  'match_turn_actions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    turnId: text('turn_id').references(() => matchTurns.id),
    side: text('side'), // 'p1' | 'p2'
    slot: integer('slot'), // 1 | 2
    actionType: text('action_type'), // 'move' | 'switch' | 'mega_move' | 'nothing'
    moveName: text('move_name'),
    targetSide: text('target_side'),
    targetSlot: integer('target_slot'),
    damageDealtPercent: real('damage_dealt_percent'),
    wasCriticalHit: integer('was_critical_hit').default(0),
    wasKo: integer('was_ko').default(0),
    switchInSpecies: text('switch_in_species'),
    switchOutSpecies: text('switch_out_species'),
    megaEvolved: integer('mega_evolved').default(0),
    moveGrade: text('move_grade'),
    gradeReason: text('grade_reason'),
    optimalPlay: text('optimal_play'),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
  },
  (table) => [
    index('match_turn_actions_turn_id_idx').on(table.turnId),
  ],
);

// ---------------------------------------------------------------------------
// meta_spreads
// ---------------------------------------------------------------------------
export const metaSpreads = sqliteTable(
  'meta_spreads',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    species: text('species').notNull(),
    format: text('format').default('champions-reg-m-a'),
    source: text('source'), // 'pikalytics' | 'smogon' | 'manual'
    nature: text('nature').notNull(),
    evs: text('evs', { mode: 'json' }),
    usagePercent: real('usage_percent'),
    rank: integer('rank'),
    commonMoves: text('common_moves', { mode: 'json' }),
    commonItems: text('common_items', { mode: 'json' }),
    commonAbilities: text('common_abilities', { mode: 'json' }),
    commonTeammates: text('common_teammates', { mode: 'json' }),
    fetchedAt: integer('fetched_at'),
    expiresAt: integer('expires_at'),
  },
  (table) => [
    index('meta_spreads_species_format_idx').on(table.species, table.format),
  ],
);

// ---------------------------------------------------------------------------
// analysis_cache
// ---------------------------------------------------------------------------
export const analysisCache = sqliteTable(
  'analysis_cache',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    cacheKey: text('cache_key').unique().notNull(),
    cacheType: text('cache_type').notNull(),
    resultJson: text('result_json', { mode: 'json' }).notNull(),
    model: text('model'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    costUsd: real('cost_usd'),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
    expiresAt: integer('expires_at'),
  },
  (table) => [
    uniqueIndex('analysis_cache_cache_key_idx').on(table.cacheKey),
  ],
);

// ---------------------------------------------------------------------------
// agent_threads
// ---------------------------------------------------------------------------
export const agentThreads = sqliteTable(
  'agent_threads',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text('title'),
    contextType: text('context_type'), // 'match' | 'team' | 'general'
    contextId: text('context_id'),
    provider: text('provider'),
    model: text('model'),
    persona: text('persona'), // e.g. 'wolfe_glick', 'cybertron', 'default'
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at').$defaultFn(() => Date.now()),
  },
);

// ---------------------------------------------------------------------------
// agent_feedback_events
// ---------------------------------------------------------------------------
export const agentFeedbackEvents = sqliteTable(
  'agent_feedback_events',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    threadId: text('thread_id').references(() => agentThreads.id),
    messageId: text('message_id'),
    eventType: text('event_type'), // 'approve' | 'reject' | 'edit' | 'correct' | 'note'
    targetType: text('target_type'), // 'tool_call' | 'answer' | 'memory' | 'write_action'
    payloadJson: text('payload_json', { mode: 'json' }),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
  },
  (table) => [
    index('agent_feedback_thread_id_idx').on(table.threadId),
  ],
);

// ---------------------------------------------------------------------------
// agent_memories
// ---------------------------------------------------------------------------
export const agentMemories = sqliteTable(
  'agent_memories',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    scope: text('scope'), // 'global' | 'team' | 'matchup' | 'thread'
    scopeRef: text('scope_ref'),
    kind: text('kind'), // 'preference' | 'strategy' | 'correction' | 'team_style' | 'opponent_pattern'
    summary: text('summary'),
    content: text('content'),
    confidence: real('confidence').default(0.5),
    sourceFeedbackId: text('source_feedback_id').references(
      (): AnySQLiteColumn => agentFeedbackEvents.id,
    ),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at').$defaultFn(() => Date.now()),
  },
  (table) => [
    index('agent_memories_scope_kind_idx').on(table.scope, table.kind),
  ],
);

// ---------------------------------------------------------------------------
// agent_artifacts
// ---------------------------------------------------------------------------
export const agentArtifacts = sqliteTable(
  'agent_artifacts',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    threadId: text('thread_id').references(() => agentThreads.id),
    artifactType: text('artifact_type'), // 'team_draft' | 'battle_report' | 'note_bundle'
    title: text('title'),
    contentJson: text('content_json', { mode: 'json' }),
    createdAt: integer('created_at').$defaultFn(() => Date.now()),
  },
  (table) => [
    index('agent_artifacts_thread_id_idx').on(table.threadId),
  ],
);

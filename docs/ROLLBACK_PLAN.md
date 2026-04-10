# Rollback Plan

## Strategy

MetaGross uses a **phase-gated rollback strategy**. Each implementation phase is independently deployable and reversible. If a phase introduces breaking issues, we can roll back to the previous phase's stable state.

## Per-Phase Rollback

### Phase 0: Scaffolding & Infrastructure
- **Rollback**: Delete the project and re-run `create-next-app`. No user data at risk.
- **Database**: `supabase db reset` restores to clean state.
- **Risk**: LOW — no user-facing features, no data.

### Phase 1: Team Entry & Management
- **Rollback**: Revert git commits for Phase 1. Teams table can be truncated.
- **Database**: `DELETE FROM team_pokemon; DELETE FROM teams;` — no cascading impact (no matches reference teams yet at this point).
- **Risk**: LOW — isolated feature, no downstream dependencies until Phase 2A.

### Phase 2A: Battle Logger Core
- **Rollback**: Revert git commits. Delete match records.
- **Database**: `DELETE FROM matches;` — match_turns and match_turn_actions cascade.
- **Risk**: LOW — matches have no analysis data yet.

### Phase 2B: Turn-by-Turn Logger
- **Rollback**: Revert git commits. Zustand store changes are client-side only (clear localStorage).
- **Database**: Turn data in `match_turns` and `match_turn_actions` can be deleted without affecting matches.
- **Risk**: MEDIUM — complex client state. Test Zustand persist/hydration thoroughly.

### Phase 2C: Match History & Stats
- **Rollback**: Revert git commits. Read-only feature; no new data written.
- **Risk**: LOW — display-only layer.

### Phase 3A: Rule-Based Analysis Engine
- **Rollback**: Revert git commits. Clear `rule_analysis_json` column in matches.
- **Database**: `UPDATE matches SET rule_analysis_json = NULL, analyzed_at = NULL;`
- **Risk**: MEDIUM — core engine. If damage calc is wrong, all analysis is wrong. Validate against known damage ranges.

### Phase 3B: EV Intelligence Engine
- **Rollback**: Revert git commits. Clear meta_spreads cache.
- **Database**: `DELETE FROM meta_spreads;` — cached data, no user data lost.
- **External APIs**: Pikalytics endpoints may change. Have fallback to `@pkmn/smogon` only.
- **Risk**: MEDIUM — external API dependency.

### Phase 3C: AI Analysis + Strategy
- **Rollback**: Revert git commits. Clear AI analysis cache.
- **Database**: `UPDATE matches SET ai_analysis_json = NULL; DELETE FROM analysis_cache;`
- **External APIs**: Claude API outage = no AI analysis. Rule-based analysis (Phase 3A) still works as fallback.
- **Risk**: LOW — additive layer on top of rule-based engine. Feature degrades gracefully.

### Phase 3D: Performance Dashboard
- **Rollback**: Revert git commits. Read-only analytics; no new data written.
- **Risk**: LOW — display-only layer.

## General Rollback Procedures

### Git
```bash
# Identify the last stable commit
git log --oneline

# Revert to last stable state
git revert --no-commit HEAD~N..HEAD
git commit -m "Revert Phase X due to [reason]"
```

### Database
```bash
# Reset to initial schema (destroys ALL data)
npx supabase db reset

# Or apply a specific rollback migration
npx supabase migration new rollback_phase_X
```

### Client State
```javascript
// Clear Zustand persisted state
localStorage.removeItem('battle-logger-storage')
```

### Environment
- Claude API key can be removed from `.env.local` to disable AI features
- App continues to function with rule-based analysis only

## Monitoring & Alerts

For production deployment:
- Monitor Claude API costs via Anthropic dashboard
- Monitor Supabase usage (DB size, API calls) via Supabase dashboard
- Set up error tracking (Sentry or similar) before public launch

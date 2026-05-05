# Champions Movepool Cuts

Species that LOSE specific moves in Pokemon Champions Reg M-A despite
@pkmn/dex still listing them as learnable. Champions cuts a subset of
TMs / egg-move tutors, so some canonical competitive moves aren't
available in-game.

**Authoritative record lives in code** — `CHAMPIONS_UNAVAILABLE_MOVES`
in `src/lib/data/champions.ts`. The validator (`validate-response.ts`)
and the `validate_team_build` tool both consult it automatically.

## Known cuts

| Species | Move(s) not in Champions | Champions replacements |
|---------|--------------------------|------------------------|
| Incineroar | Knock Off | Fake Out, Flare Blitz, Parting Shot, Darkest Lariat, Throat Chop |

When adding entries:
1. Confirm in-game (not just Showdown preview — Showdown may include
   moves cut on-cartridge).
2. Add to `CHAMPIONS_UNAVAILABLE_MOVES` as `SpeciesName: ["Move Name"]`.
3. Match base-species naming (no `-Mega` suffix — the helper strips
   that automatically).
4. Add a row here with a concrete replacement so the agent's prompt
   surfaces a usable alternative.

# Champions Reg M-A — roster authority sources

When any doubt arises about whether a Pokemon or Mega is legal in the
Champions format, cross-reference these, in order of authority:

1. **Osirus Champions Tracker (Google Sheet)** — community-maintained,
   updated within hours of gameplay trailers:
   - https://docs.google.com/spreadsheets/d/e/2PACX-1vSvOpu4qaQhDRQLZ6FrNDkjzjwe8LtGicQsr0QzzT9NPKestDnTQ3MYNTRZPsE1dG__KdToKq3rkJbX/pubhtml?gid=0&single=true
   - Sheet has two sections:
     1. **Confirmed and Shown in Gameplay Trailers** (rows 3–203) —
        the source of truth for what's in the game right now.
     2. **Mega Evolutions Expected to be available that have not been
        shown** (rows 207+) — do NOT treat these as confirmed. They
        are speculative.
   - CSV export:
     `https://docs.google.com/spreadsheets/d/e/2PACX-1vSvOpu4qaQhDRQLZ6FrNDkjzjwe8LtGicQsr0QzzT9NPKestDnTQ3MYNTRZPsE1dG__KdToKq3rkJbX/pub?gid=0&single=true&output=csv`
   - Known typos in the sheet: "Starmiie", "Aerodactly", "Victreebell",
     "Weaville", "Emploeon", "Conkelldurr", "Croviknight", "Hydriegon",
     "Medichamp", "Manetric", "Alteria", "Archuludon", "Skeledirege",
     "Tinkaron", "Garcanacl". Normalize before comparing.

2. **Bulbapedia — List of Pokémon in Pokémon Champions**:
   https://bulbapedia.bulbagarden.net/wiki/List_of_Pokémon_in_Pokémon_Champions
   (Sections: Pokemon list, Mega Stones)

3. **Serebii**: https://serebii.net/pokemonchampions/

## Validation rule of thumb

- A Pokemon is legal if it appears in **both** the Osirus sheet (confirmed
  section) AND Bulbapedia. If one has it and the other doesn't, err on
  the side of caution — fetch_reference both pages and confirm.
- For Megas: same rule. The sheet's Mega column (Yes/No) matters; "Yes"
  means a Mega Stone has been confirmed playable in Format M-A.

## Last sync

Confirmed section from the sheet synced 2026-04-16. Our
`CHAMPIONS_POKEMON` matches all 200 confirmed species; we additionally
track Lycanroc-Dusk and Lycanroc-Midnight because @pkmn/dex treats them
as separate species (the sheet folds them under one "Lycanroc" row).

Our `CHAMPIONS_MEGAS` matches all 57 Mega=Yes rows on the sheet, plus
three extras that Bulbapedia confirms but the sheet doesn't explicitly
list (Audino-Mega, Sableye-Mega, Meowstic-M-Mega / Meowstic-F-Mega —
where the sheet has a single "Meowstic" row).

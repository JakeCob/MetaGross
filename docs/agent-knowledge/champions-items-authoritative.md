# Champions Items — Authoritative List

**Source of truth**: Game8 — https://game8.co/games/Pokemon-Champions/archives/588871
**Last verified**: 2026-04-20

## Items NOT in Pokemon Champions (common VGC staples that DO NOT exist here)

Do NOT suggest any of these — they are not obtainable in Pokemon Champions Reg M-A:

- **Weakness Policy** — often mistakenly recommended for Aegislash / bulky offensive mons. Not in game.
- **Life Orb** — use a type-boost held item (Charcoal, Black Glasses, Mystic Water, Soft Sand, Silk Scarf, Magnet, etc.) instead.
- **Choice Band** / **Choice Specs** — only **Choice Scarf** exists. For damage, use type-boost items.
- **Assault Vest** — no equivalent; use Sitrus Berry or a type-resist berry (Roseli, Yache, Chople, Babiri, etc.) for situational bulk.
- **Rocky Helmet** / **Safety Goggles** / **Clear Amulet** / **Covert Cloak** — none of these are in.
- **Eject Button** / **Eject Pack** / **Throat Spray** / **Power Herb** / **Room Service** — none in.
- **Air Balloon** — no Ground-immunity item exists in Champions.
- **Toxic Orb** / **Flame Orb** — not in game, which means Guts / Quick Feet / Poison Heal / Flare Boost cannot self-activate.
- **Mirror Herb** / **Psychic Seed** / **Grassy/Electric/Misty Seed** — none in.
- **Wide Lens** / **Muscle Band** / **Adrenaline Orb** / **Razor Fang** / **Black Sludge** — none in.
- **Figy Berry** / **Aguav Berry** / **Iapapa Berry** / **Mago Berry** / **Wiki Berry** — the "confusing" pinch berries are NOT in game. The pinch berries that ARE in are Sitrus, Lum, Persim, Oran, Leppa, Aspear, Rawst, Pecha, Chesto, Cheri.
- **Loaded Dice** / **Heavy-Duty Boots** / **Eviolite** / **Light Clay** — not in format at all.

## Items that ARE in Champions — use these

**Staples**: Focus Sash, Choice Scarf, Leftovers, Shell Bell, White Herb, Mental Herb, Focus Band, Light Ball, King's Rock, Bright Powder, Scope Lens, Quick Claw

**Type-boost held items (20%, no recoil — Life Orb substitute)**: Soft Sand (Ground), Sharp Beak (Flying), Silk Scarf (Normal), Magnet (Electric), Black Belt (Fighting), Black Glasses (Dark), Silver Powder (Bug), Miracle Seed (Grass), Hard Stone (Rock), Mystic Water (Water), Poison Barb (Poison), Never-Melt Ice (Ice), Twisted Spoon (Psychic), Charcoal (Fire), Dragon Fang (Dragon), Fairy Feather (Fairy), Spell Tag (Ghost), Metal Coat (Steel)

**Pinch berries**: Sitrus, Lum, Persim, Oran, Leppa, Aspear, Rawst, Pecha, Chesto, Cheri

**Type-resist berries (the ones that exist)**: Roseli (Fairy), Chilan (Normal), Babiri (Steel), Haban (Dragon), Charti (Rock), Tanga (Bug), Payapa (Psychic), Kebia (Poison), Chople (Fighting), Rindo (Grass), Occa (Fire), Wacan (Electric), Colbur (Dark), Kasib (Ghost), Coba (Flying), Shuca (Ground), Yache (Ice), Passho (Water)

## Canonical list in code

`src/lib/data/champions.ts`:

- `CHAMPIONS_ITEMS_CONFIRMED` — every item Game8 lists.
- `CHAMPIONS_ITEMS_BANNED` — the explicit rejection list. The validator (`validate-response.ts`) hard-rejects any response mentioning one of these items.
- `CHAMPIONS_ITEMS_UNCERTAIN` — items reported elsewhere but not on Game8 (currently only Raichunite X / Y).

If Game8 updates their list, update `CHAMPIONS_ITEMS_CONFIRMED` in one place and every prompt/validator picks up the change automatically.

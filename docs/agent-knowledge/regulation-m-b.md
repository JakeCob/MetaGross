# Champions Reg M-B — what changed vs M-A

**Active period:** June 17 2026 – September 2 2026 (M-A ran April 8 – June 17 2026).
**M-B is purely additive to M-A** — every M-A-legal Pokemon/item/mega stays legal; M-B
only *adds* content and *un-bans* a few things. Both regulations coexist in code
(`REGULATIONS` registry in `src/lib/data/champions.ts`); `ACTIVE_REGULATION = "m-b"`.

## Sources (authority order, same as M-A)

1. **Serebii — Regulation M-B**: https://www.serebii.net/pokemonchampions/rankedbattle/regulationm-b.shtml
   (newly-useable Pokemon + newly-added items + format timings).
2. **Bulbapedia — Mega Stone**: https://bulbapedia.bulbagarden.net/wiki/Mega_Stone
   (exact Mega Stone names, incl. the invented Z-A megas).
3. Bulbapedia — List of Pokémon in Pokémon Champions / Game8 (cross-check).

**Last synced: 2026-06-17.**

## Newly legal Pokemon (22 base species added to the roster)

Vileplume, Qwilfish, Sceptile, Blaziken, Swampert, Mawile, Metagross, Staraptor,
Musharna, Scolipede, Scrafty, Eelektross, Pyroar, Malamar, Barbaracle, Dragalge,
Grimmsnarl, Falinks, Overqwil, Houndstone, Annihilape, Gholdengo.

> **Metagross, Grimmsnarl, and Gholdengo were in M-A's `NOT_IN_CHAMPIONS` banlist** —
> they are removed from the M-B banlist and added to the M-B roster.

## New Mega Evolutions (16 stone→form mappings added for M-B)

Canonical (real ORAS stones): Sceptile→**Sceptilite**, Blaziken→**Blazikenite**,
Swampert→**Swampertite**, Mawile→**Mawilite**, Metagross→**Metagrossite**.
Raichu→**Raichunite X / Raichunite Y** (these were `CHAMPIONS_ITEMS_UNCERTAIN` in M-A;
M-B confirms them).

Invented Z-A megas (stone names from Bulbapedia, irregular — do NOT derive):
Staraptor→**Staraptite**, Scolipede→**Scolipite**, Scrafty→**Scraftinite**,
Eelektross→**Eelektrossite**, Pyroar→**Pyroarite**, Malamar→**Malamarite**,
Barbaracle→**Barbaracite**, Dragalge→**Dragalgite**, Falinks→**Falinksite**.

> **Mega signature abilities ARE needed.** `@pkmn/dex` resolves the invented mega
> *forms* but reports only the BASE ability (e.g. Eelektross-Mega → "Levitate"),
> NOT the real Champions signature ability (Eelektross-Mega → "Eelevate"). These
> live in `CHAMPIONS_MEGA_ABILITIES` in `champions.ts`, sourced from
> serebii.net/pokemonchampions/megaabilities.shtml (synced 2026-06-17). Real
> Gen-6 ORAS megas (Sceptile/Blaziken/Swampert/Mawile/Metagross) are omitted —
> the dex has those correct. `validateSet` and the team-builder display both read
> this map (via `getMegaAbility` / `getMegaAbilityFor`).
>
> **Mega sprites:** Showdown has no sprite for invented Champions megas, so
> `PokemonSprite` falls back to the base-form gif and shows a "base" marker
> (no official Mega art exists for these forms).

## Items

**Un-banned (were in M-A `CHAMPIONS_ITEMS_BANNED`, now legal):** Life Orb, Wide Lens,
Muscle Band, Light Clay, Damp Rock, Heat Rock, Smooth Rock, Icy Rock.

**Newly added (were simply absent before):** Wise Glasses, Expert Belt, Zoom Lens,
Metronome, Iron Ball, Shed Shell, Big Root — plus the 16 mega stones above.

> Life Orb being legal is a major meta shift: the M-A item doc's "use a type-boost
> item instead of Life Orb" guidance no longer applies in M-B.

## Unchanged from M-A

Format rules (Doubles VGC, bring-6-pick-4, Megas on, **no Tera**, IVs fixed 31),
the 66-point stat system, and `CHAMPIONS_UNAVAILABLE_MOVES` (Incineroar: Knock Off).

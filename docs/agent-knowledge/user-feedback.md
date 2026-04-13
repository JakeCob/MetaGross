# MetaGross Agent — User Feedback & Corrections

This is the agent's long-term knowledge base of user corrections and expectations.
The agent should reference this when building teams, analyzing matches, or suggesting EV spreads.

Last updated: 2026-04-12

---

## ❌ Common Mistakes to AVOID

### Pokemon NOT in Champions Reg M-A
These Pokemon are commonly mistakenly suggested. DO NOT recommend them:

- **Ludicolo** — NOT in Champions. Use Basculegion, Pelipper, or Gastrodon for similar roles.
- **Kingdra** — NOT in Champions. Use Basculegion, Gyarados, Milotic.
- **Ferrothorn** — NOT in Champions. Use Archaludon (Steel/Dragon) or Kingambit.
- **Amoonguss** — NOT in Champions. Use Sinistcha (has Rage Powder + Hospitality).
- **Rillaboom** — NOT in Champions. Use Meowscarada or Venusaur.
- **Flutter Mane** — Paradox, NOT in Champions. Use Gengar or Sinistcha.
- **Iron Hands / Iron Crown / Raging Bolt** — All Paradox, NOT in Champions.
- **Urshifu / Urshifu-Rapid-Strike** — Restricted, NOT in Champions. Use Sneasler.
- **Calyrex / Koraidon / Miraidon / Zacian / Zamazenta** — Restricted legends, NOT in Champions.
- **Ogerpon / Tornadus / Landorus / Chien-Pao** — NOT in Champions.

**Rule:** If the meta data shows a Pokemon at high usage, verify it's actually in Champions first.
Meta usage data on Showdown may include Pokemon the cartridge doesn't have.

### Wrong Ability Choices
- **Basculegion on rain teams**: Use **Swift Swim** (doubles speed in rain), NOT Adaptability.
  Adaptability is used on non-weather teams. Swift Swim synergizes with rain setters.
- **Venusaur on sun teams**: Use **Chlorophyll**, NOT Overgrow.
- **Excadrill on sand teams**: Use **Sand Rush**, NOT Mold Breaker.
- Team archetype > raw Pikalytics usage % when choosing abilities.

### Nature / Stat Mismatches
- Special attackers get **Modest** or **Timid**. NEVER Adamant/Jolly.
- Physical attackers get **Adamant** or **Jolly**. NEVER Modest/Timid.
- Basculegion on rain team = Physical attacker with Swift Swim → **Jolly**, max Atk + max Spe.

### EV Spread Format
- **Champions uses Stat Points: 66 total, 32 max per stat.**
- NOT traditional EVs (510/252). Never output 252 or 510.
- Copy the spread from `optimize_ev_spread` tool EXACTLY — don't invent your own.
- Don't lazy-max 2 stats. Spread across 3-5 stats based on specific benchmarks.

---

## ✅ Preferred Team Building Approach

### Top Meta Staples (use these by default unless good reason not to)

**S-Tier (use in most teams):**
- **Incineroar** — Intimidate pivot, Fake Out support. Works on almost every team.
- **Archaludon** — Rain team anchor. Stamina + Electro Shot + Assault Vest = OHKO machine.
- **Sneasler** — Unburden sweeper, OHKOs Steel types with Close Combat.
- **Sinistcha** — Hospitality healer, Rage Powder redirect. Great glue.

**Archetype Specialists:**
- **Rain**: Pelipper (Drizzle) + Archaludon + Basculegion (Swift Swim) + Dragonite (Multiscale)
- **Sun**: Torkoal (Drought) / Charizard-Mega-Y + Venusaur (Chlorophyll) + Whimsicott
- **Sand**: Tyranitar (Sand Stream) + Excadrill (Sand Rush) + Garchomp
- **Trick Room**: Farigiraf (Armor Tail) + Sinistcha + Dondozo + slow attackers
- **Hyper Offense**: Dragapult + Sneasler + Metagross-Mega + Kingambit

### Why 2 Rain Setters is USUALLY Wrong
Having Pelipper AND Politoed both on the same team is **redundant and wastes a slot**.
One rain setter is enough. Use the second slot for:
- A rain abuser (Basculegion with Swift Swim)
- A rain-immune Pokemon (Dragonite flies over Ground)
- A Trick Room counter (Sinistcha)
- A Steel type (Archaludon)

**Exception:** If the meta is weather-war heavy, you can run 2 setters. But be EXPLICIT about why.

---

## 📋 Required Output Sections

A team recommendation MUST include:

1. **6 Pokemon cards** with role, ability (with synergy reason), item, nature (matching role), moves (unique), points (66 total, 32 max), spread reasoning
2. **Team Summary** — 2-3 sentences on win condition and synergy
3. **Matchup Analysis** — lead combinations vs common meta teams:
   - VS Standard teams
   - VS Sun (if team is rain/sand)
   - VS Rain (if team is sun/sand)
   - VS Sand (tough for rain, include if applicable)
   - VS Trick Room
   - VS Fairy-heavy
   - VS S-tier threats (Mega Gardevoir, Kangaskhan, etc.)

Each matchup should specify:
- Recommended LEAD (2 Pokemon)
- BACK (2 more Pokemon to bring)
- Turn 1-2 game plan
- Key threats to watch for

---

## 🎯 Style Preferences

- **Concise reasoning** — explain WHY in 1-2 sentences per field, not paragraphs
- **Data-driven** — back claims with benchmarks ("survives 252+ Atk Garchomp Earthquake")
- **No filler** — skip "This spread is crucial because..." unless adding real info
- **Acknowledge uncertainty** — if data is missing, say "I don't have current usage data for X"

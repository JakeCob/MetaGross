/**
 * Item-aware spread guidance shared across the EV-debate nodes.
 *
 * The held item materially changes the optimal spread, so every node that
 * reasons about stats is fed this block. When the user has already chosen an
 * item we treat it as LOCKED — the optimizer's job is to build the best spread
 * *for that item*, not to second-guess the user's item choice. When no item is
 * set, the same guidance tells the model to pick one and build around it.
 */

function bullets(label: string): string {
  return [
    `- White Herb / Clear Amulet: protect the attacking stat from an opponent's Intimidate (and undo Close Combat / Overheat / Draco Meteor self-drops). The drop won't stick, so go MAX in that attacking stat — e.g. White Herb Incineroar wants max Attack.`,
    `- Focus Sash: already guarantees surviving one hit from full HP — do NOT spend defensive ${label} on bulk the Sash covers; bank it into offense / Speed (pairs with frail, fast, hard-hitting spreads).`,
    `- Choice Band / Specs: MAX the locked attacking stat (Band = Atk, Specs = SpA). Choice Scarf: ×1.5 Speed means less Speed investment needed — keep the attacking stat maxed.`,
    `- Life Orb / type-boost items (Charcoal, Mystic Water, etc.): pure offense — maximize the offensive stat + the Speed you need.`,
    `- Leftovers / Sitrus Berry / Eviolite / Rocky Helmet / Assault Vest: reward bulk — HP/Def/SpD investment pays off (Assault Vest already adds +50% SpD, so spend SpD ${label} elsewhere).`,
    `- Booster Energy (Protosynthesis / Quark Drive): boosts the highest stat — shape the spread so the stat you want boosted ends up highest.`,
    `- Mega Stone: build for the MEGA form's base stats and typing.`,
  ].join("\n");
}

/**
 * Build the item-guidance block for a node's system prompt.
 * @param item  the user's chosen item (empty/undefined → "pick one" mode)
 * @param label "Points" (Champions) or "EVs"
 */
export function evItemGuidance(item: string | undefined, label: string): string {
  const it = item?.trim();
  if (it) {
    return `ITEM IS LOCKED to "${it}" — the user chose this item deliberately. Output EXACTLY "${it}" as the Item and do NOT change it (the only exception is an item that is illegal in this format). Do not suggest swapping it. Build the Nature and ${label} to MAXIMIZE this item's payoff:\n${bullets(label)}`;
  }
  return `ITEM-AWARE SPREAD — pick the item that best fits the role, then build the entire ${label} spread around it:\n${bullets(label)}`;
}

/** The user's item, if they set one — the value the optimizer must preserve. */
export function lockedItem(item: string | undefined): string | undefined {
  const it = item?.trim();
  return it || undefined;
}

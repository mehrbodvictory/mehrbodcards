// ---- Tier / color definitions -------------------------------------------
// Tier 1 = Blue, 2 = Green, 3 = Red, 4 = Orange (max tier).
export const TIERS = {
  1: { name: 'Blue',   hex: '#3E7CB1', hp: 1, dmg: 1, sp: 0, defends: Infinity },
  2: { name: 'Green',  hex: '#4C9A5B', hp: 2, dmg: 2, sp: 1, defends: 2 },
  3: { name: 'Red',    hex: '#C1443C', hp: 3, dmg: 3, sp: 2, defends: 1 },
  4: { name: 'Orange', hex: '#E08A2C', hp: 4, dmg: 4, sp: 3, defends: 0 },
};

export function tierOf(n) { return TIERS[n]; }

// Merging combines two cards' tier values, capped at the max tier (4/Orange).
// e.g. Blue(1)+Green(2)=3 Red, Blue+Blue=2 Green, Green+Green=4 Orange,
// Blue+Red=4 Orange, anything totalling >=4 becomes Orange.
export function mergedTier(a, b) {
  return Math.min(4, a + b);
}

// ---- Abilities -----------------------------------------------------------
// Abilities are small data objects interpreted by game.js. Keeping them as
// data (not closures) keeps the whole match log serializable & deterministic.
export const ABILITIES = {
  none:        { id: 'none', label: '' },
  onplay_dmg2: { id: 'onplay_dmg2', label: 'On placement: deal 2 dmg to a selected enemy card.' },
  onplay_dmg1: { id: 'onplay_dmg1', label: 'On placement: deal 1 dmg to a selected enemy card.' },
  ondeath_dmg2:{ id: 'ondeath_dmg2', label: 'On death: deal 2 dmg to a selected enemy card.' },
  onplay_heal2:{ id: 'onplay_heal2', label: 'On placement: heal a selected ally card 2 hp.' },
  ondeath_heal1:{ id:'ondeath_heal1', label: 'On death: heal a selected ally card 1 hp.' },
  onattack_pierce:{ id:'onattack_pierce', label: 'Attacks ignore defense once.' },
  onplay_shield1:{ id:'onplay_shield1', label: 'On placement: gain +1 defense charge.' },
};

const ABILITY_POOL_BY_TIER = {
  1: ['none', 'none', 'none', 'onplay_dmg1'],
  2: ['none', 'none', 'onplay_dmg1', 'onplay_heal2', 'ondeath_heal1'],
  3: ['none', 'onplay_dmg2', 'ondeath_dmg2', 'onattack_pierce', 'onplay_shield1'],
  4: ['onplay_dmg2', 'ondeath_dmg2', 'onattack_pierce'],
};

let _uid = 0;
export function nextId() { return 'c' + (++_uid); }

export function makeUnitCard(tier, rng, abilityId) {
  const t = TIERS[tier];
  const ability = abilityId || rng.pick(ABILITY_POOL_BY_TIER[tier]);
  return {
    id: nextId(),
    kind: 'unit',
    tier,
    name: `${t.name} ${tier === 1 ? 'Sprite' : tier === 2 ? 'Warden' : tier === 3 ? 'Wraith' : 'Colossus'}`,
    hp: t.hp,
    maxHp: t.hp,
    dmg: t.dmg,
    sp: t.sp,
    ability,
    defendChargesUsed: 0,   // how many times this card has already defended
    canAttackAgain: false,  // set when a queued attack must resolve next cycle
    pendingAttackTargetId: null,
  };
}

// Spells target board cards directly, chips modify a card's stats. Both are
// used from the hand at any point (placement or attack) and are not part of
// the 12-card unit deck.
export const SPELL_DEFS = [
  { id: 'bolt3', kind: 'spell', name: 'Bolt', text: 'Deal 3 damage to target card.', dmg: 3 },
  { id: 'bolt5', kind: 'spell', name: 'Greater Bolt', text: 'Deal 5 damage to target card.', dmg: 5 },
  { id: 'mend3', kind: 'spell', name: 'Mend', text: 'Heal target card 3 hp.', heal: 3 },
  { id: 'purge', kind: 'spell', name: 'Purge', text: "Remove all of target card's defense charges used (refresh its defense).", refreshDefense: true },
];

export const CHIP_DEFS = [
  { id: 'chip_atk', kind: 'chip', name: 'Power Chip', text: '+1 DMG to a card with a free chip slot.', dmg: 1 },
  { id: 'chip_hp', kind: 'chip', name: 'Guard Chip', text: '+2 HP to a card with a free chip slot.', hp: 2 },
];

export function makeSpellOrChip(def) {
  return { ...def, id: nextId(), defId: def.id };
}

// ---- Deck building ---------------------------------------------------------
// 12 unit cards per player deck, weighted toward lower tiers (so merging up
// is meaningful), plus 4 spells + 2 chips drawn from the pools above.
export function buildDeck(rng) {
  const weights = [ [1,1,1,1,1,1], [2,2,2], [3,3], [4] ]; // 6 blue, 3 green, 2 red, 1 orange
  let units = [];
  weights.forEach(group => group.forEach(tier => units.push(makeUnitCard(tier, rng))));
  units = rng.shuffle(units);

  const spellChoices = rng.shuffle(SPELL_DEFS.concat(SPELL_DEFS)).slice(0, 4);
  const chipChoices = rng.shuffle(CHIP_DEFS.concat(CHIP_DEFS)).slice(0, 2);

  return {
    units,                                            // 12 unit cards, unseen until drawn
    spells: spellChoices.map(makeSpellOrChip),        // 4 spells, in hand from game start
    chips: chipChoices.map(makeSpellOrChip),          // 2 chips, in hand from game start
  };
}

export function chipSlotsFree(card) {
  const used = card.chipsAttached ? card.chipsAttached.length : 0;
  return Math.max(0, card.sp - used);
}

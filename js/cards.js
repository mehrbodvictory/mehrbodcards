// ---- Tier / color definitions -------------------------------------------
// Tier 1 = Blue, 2 = Green, 3 = Red, 4 = Orange (max tier).
// Defense charges per tier: Blue is unlimited, Green gets exactly one
// block, and Red/Orange can no longer defend at all.
const TIERS = {
  1: { name: 'Blue',   hex: '#3E7CB1', hp: 1, dmg: 1, sp: 0, defends: Infinity },
  2: { name: 'Green',  hex: '#4C9A5B', hp: 2, dmg: 2, sp: 1, defends: 1 },
  3: { name: 'Red',    hex: '#C1443C', hp: 3, dmg: 3, sp: 2, defends: 0 },
  4: { name: 'Orange', hex: '#E08A2C', hp: 4, dmg: 4, sp: 3, defends: 0 },
};

function tierOf(n) { return TIERS[n]; }

// Merging combines two cards' tier values, capped at the max tier (4/Orange).
// e.g. Blue(1)+Green(2)=3 Red, Blue+Blue=2 Green, Green+Green=4 Orange,
// Blue+Red=4 Orange, anything totalling >=4 becomes Orange.
function mergedTier(a, b) {
  return a + b; // caller validates this lands on a real tier (2, 3, or 4) before using it
}

// ---- Abilities -----------------------------------------------------------
// Abilities are small data objects interpreted by game.js. Keeping them as
// data (not closures) keeps the whole match log serializable & deterministic.
const ABILITIES = {
  none:        { id: 'none', label: '' },

  // Original ability set (still used by the classic Warden/Wraith/Colossus
  // archetypes' random pools below).
  onplay_dmg2: { id: 'onplay_dmg2', label: 'On placement: deal 2 dmg to a selected enemy card.' },
  onplay_dmg1: { id: 'onplay_dmg1', label: 'On placement: deal 1 dmg to a selected enemy card.' },
  ondeath_dmg2:{ id: 'ondeath_dmg2', label: 'On death: deal 2 dmg to a selected enemy card.' },
  onplay_heal2:{ id: 'onplay_heal2', label: 'On placement: heal a selected ally card 2 hp.' },
  ondeath_heal1:{ id:'ondeath_heal1', label: 'On death: heal a selected ally card 1 hp.' },
  onattack_pierce:{ id:'onattack_pierce', label: 'Attacks ignore defense once.' },
  onplay_shield1:{ id:'onplay_shield1', label: 'On placement: gain +1 defense charge.' },

  // New Green archetypes - each ability below belongs to exactly one named
  // card and no other card, spell, or chip in the game has the same effect.
  green_onplay_healall1:   { id: 'green_onplay_healall1', label: 'On placement: heal all your cards 1 hp.' },
  green_ondeath_draw1:     { id: 'green_ondeath_draw1', label: 'On death: draw a card.' },
  green_onplay_selftoughen1:{ id: 'green_onplay_selftoughen1', label: 'On placement: this card gains +1 max HP.' },
  green_onplay_discard1:   { id: 'green_onplay_discard1', label: "On placement: the enemy discards a random card from hand." },

  // New Red archetypes.
  red_onplay_dmgall1:      { id: 'red_onplay_dmgall1', label: 'On placement: deal 1 dmg to every enemy card.' },
  red_ondeath_thorns1:     { id: 'red_ondeath_thorns1', label: 'On death: deals 1 dmg back to whatever attacked it.' },
  red_onplay_buffallies_dmg1:{ id: 'red_onplay_buffallies_dmg1', label: 'On placement: all your cards gain +1 DMG.' },
  red_onattack_splash1:    { id: 'red_onattack_splash1', label: 'Attacks also splash 1 dmg to a second random enemy.' },

  // New Orange archetypes.
  orange_onplay_execute:   { id: 'orange_onplay_execute', label: "On placement: destroy the enemy's weakest card." },
  orange_onplay_scaledmg:  { id: 'orange_onplay_scaledmg', label: 'On placement: this card gains +1 DMG per enemy card on the board.' },
  orange_ondeath_dmg4:     { id: 'orange_ondeath_dmg4', label: 'On death: deal 4 dmg to a selected enemy card.' },
  orange_onplay_refreshall:{ id: 'orange_onplay_refreshall', label: "On placement: refresh every ally's defense charges." },
};

// ---- Unit archetypes -------------------------------------------------------
// Each tier has 5 named archetypes: the original "classic" card (which keeps
// its old randomized ability pool, unchanged), plus 4 new cards each with
// exactly one guaranteed, unique ability. Blue's pools are all ['none'] only
// - Blue cards can never roll a special ability (see fix note below).
const UNIT_ARCHETYPES = {
  1: [ // Blue - bugfix: Blue used to be able to roll onplay_dmg1 from its
       // pool. Blue is meant to be the disposable, ability-free tier (it's
       // also the only tier that regenerates for free), so every Blue
       // archetype's pool is fixed to 'none' with no exceptions.
    { name: 'Blue Sprite',  pool: ['none'] },
    { name: 'Blue Recruit', pool: ['none'] },
    { name: 'Blue Scout',   pool: ['none'] },
    { name: 'Blue Cadet',   pool: ['none'] },
    { name: 'Blue Drifter', pool: ['none'] },
  ],
  2: [ // Green
    { name: 'Green Warden',     pool: ['none', 'none', 'onplay_dmg1', 'onplay_heal2', 'ondeath_heal1', 'onplay_shield1'] },
    { name: 'Green Chaplain',   pool: ['green_onplay_healall1'] },
    { name: 'Green Pathfinder', pool: ['green_ondeath_draw1'] },
    { name: 'Green Bulwark',    pool: ['green_onplay_selftoughen1'] },
    { name: 'Green Saboteur',   pool: ['green_onplay_discard1'] },
  ],
  3: [ // Red
    { name: 'Red Wraith',     pool: ['none', 'onplay_dmg2', 'ondeath_dmg2', 'onattack_pierce'] },
    { name: 'Red Firestarter',pool: ['red_onplay_dmgall1'] },
    { name: 'Red Vindicator', pool: ['red_ondeath_thorns1'] },
    { name: 'Red Warchief',   pool: ['red_onplay_buffallies_dmg1'] },
    { name: 'Red Cannoneer',  pool: ['red_onattack_splash1'] },
  ],
  4: [ // Orange
    { name: 'Orange Colossus',  pool: ['onplay_dmg2', 'ondeath_dmg2', 'onattack_pierce'] },
    { name: 'Orange Devastator',pool: ['orange_onplay_execute'] },
    { name: 'Orange Juggernaut',pool: ['orange_onplay_scaledmg'] },
    { name: 'Orange Reaper',    pool: ['orange_ondeath_dmg4'] },
    { name: 'Orange Sentinel',  pool: ['orange_onplay_refreshall'] },
  ],
};

let _uid = 0;
function nextId() { return 'c' + (++_uid); }

function makeUnitCard(tier, rng, forcedAbility) {
  const t = TIERS[tier];
  const archetype = rng.pick(UNIT_ARCHETYPES[tier]);
  const ability = forcedAbility || rng.pick(archetype.pool);
  return {
    id: nextId(),
    kind: 'unit',
    tier,
    name: archetype.name,
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
// the 12-card unit deck. Every effect below is mechanically distinct from
// every other spell, chip, and card ability in the game.
const SPELL_DEFS = [
  { id: 'bolt3', kind: 'spell', name: 'Bolt', text: 'Deal 3 damage to target card.', dmg: 3 },
  { id: 'bolt5', kind: 'spell', name: 'Greater Bolt', text: 'Deal 5 damage to target card.', dmg: 5 },
  { id: 'mend3', kind: 'spell', name: 'Mend', text: 'Heal target card 3 hp.', heal: 3 },
  { id: 'purge', kind: 'spell', name: 'Purge', text: "Remove all of target card's defense charges used (refresh its defense).", refreshDefense: true },
  { id: 'chainbolt', kind: 'spell', name: 'Chain Bolt', text: 'Deal 2 damage to target card, then 1 splash damage to a second random enemy card.', dmg: 2, splash: 1 },
  { id: 'massmend', kind: 'spell', name: 'Mass Mend', text: "Heal all of target's owner's cards 2 hp.", healAll: 2 },
  { id: 'weaken', kind: 'spell', name: 'Weaken', text: "Permanently reduce target card's DMG by 2 (minimum 0).", weakenDmg: 2 },
  { id: 'adrenaline', kind: 'spell', name: 'Adrenaline', text: 'Deal 1 damage to target card, but permanently grant it +3 DMG.', dmg: 1, buffDmg: 3 },
];

const CHIP_DEFS = [
  { id: 'chip_atk', kind: 'chip', name: 'Power Chip', text: '+1 DMG to a card with a free chip slot.', dmg: 1 },
  { id: 'chip_hp', kind: 'chip', name: 'Guard Chip', text: '+2 HP to a card with a free chip slot.', hp: 2 },
  { id: 'chip_twin', kind: 'chip', name: 'Twin Edge Chip', text: '+1 DMG and +1 HP to a card with a free chip slot.', dmg: 1, hp: 1 },
  { id: 'chip_overcharge', kind: 'chip', name: 'Overcharge Chip', text: '+2 DMG to a card with a free chip slot.', dmg: 2 },
  { id: 'chip_fortify', kind: 'chip', name: 'Fortify Chip', text: '+3 HP to a card with a free chip slot.', hp: 3 },
  { id: 'chip_lifeblood', kind: 'chip', name: 'Lifeblood Chip', text: 'Whenever this card lands an attack, it heals itself 1 hp.', lifesteal: 1 },
];

function makeSpellOrChip(def) {
  return { ...def, id: nextId(), defId: def.id };
}

// ---- Deck building ---------------------------------------------------------
// 12 unit cards per player deck, weighted toward lower tiers (so merging up
// is meaningful), plus 4 spells + 2 chips drawn from the pools above.
function buildDeck(rng) {
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

function chipSlotsFree(card) {
  const used = card.chipsAttached ? card.chipsAttached.length : 0;
  return Math.max(0, card.sp - used);
}

function cardHasChip(card, chipDefId) {
  return !!(card.chipsAttached && card.chipsAttached.includes(chipDefId));
}

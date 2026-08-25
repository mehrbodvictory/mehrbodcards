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

  // v3.2 restoration: these were originally each a single named card's own
  // fixed, guaranteed ability - a later update accidentally lumped them
  // into shared randomized pools (Warden and Wraith could both roll
  // 'none' and end up with no ability at all; Wraith and Colossus even
  // shared the exact same pool, so two different cards could roll the
  // identical ability). Every non-Blue archetype below is now locked to
  // exactly one ability that belongs to it and no other card in the game.
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
  // v3.0: there's no more hand to "draw" into - every card is available
  // to place from the moment a match starts. This ability's slot is now a
  // small consolation heal instead.
  green_ondeath_draw1:     { id: 'green_ondeath_draw1', label: 'On death: heal your weakest card 1 hp.' },
  green_onplay_selftoughen1:{ id: 'green_onplay_selftoughen1', label: 'On placement: this card gains +1 max HP.' },
  // v3.0: "discards a card from hand" doesn't exist anymore either -
  // instead this permanently removes a random Blue card from the enemy's
  // remaining deck, denying them a future placement.
  green_onplay_discard1:   { id: 'green_onplay_discard1', label: "On placement: permanently remove a random Blue card from the enemy's deck." },

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
// Each tier has 5 named archetypes, and every single one (Blue excluded)
// has exactly one guaranteed, unique ability that belongs to it and no
// other card in the game - see the v3.2 restoration note above ABILITIES.
// Blue's pools are all ['none'] only - Blue cards can never roll a special
// ability (see fix note below).
const UNIT_ARCHETYPES = {
  1: [ // Blue - bugfix: Blue used to be able to roll onplay_dmg1 from its
       // pool. Blue is meant to be the disposable, ability-free tier (it's
       // also the only tier that regenerates for free), so every Blue
       // archetype's pool is fixed to 'none' with no exceptions. Every Blue
       // archetype is always owned for free - they're mechanically
       // identical, so there's no reason to gate them behind the Shop.
    { id: 'blue_sprite',  name: 'Blue Sprite',  pool: ['none'] },
    { id: 'blue_recruit', name: 'Blue Recruit', pool: ['none'] },
    { id: 'blue_scout',   name: 'Blue Scout',   pool: ['none'] },
    { id: 'blue_cadet',   name: 'Blue Cadet',   pool: ['none'] },
    { id: 'blue_drifter', name: 'Blue Drifter', pool: ['none'] },
  ],
  2: [ // Green
    { id: 'green_warden',     name: 'Green Warden',     pool: ['onplay_heal2'] },
    { id: 'green_chaplain',   name: 'Green Chaplain',   pool: ['green_onplay_healall1'] },
    { id: 'green_pathfinder', name: 'Green Pathfinder', pool: ['green_ondeath_draw1'] },
    { id: 'green_bulwark',    name: 'Green Bulwark',    pool: ['green_onplay_selftoughen1'] },
    { id: 'green_saboteur',   name: 'Green Saboteur',   pool: ['green_onplay_discard1'] },
  ],
  3: [ // Red
    { id: 'red_wraith',      name: 'Red Wraith',      pool: ['onattack_pierce'] },
    { id: 'red_firestarter', name: 'Red Firestarter', pool: ['red_onplay_dmgall1'] },
    { id: 'red_vindicator',  name: 'Red Vindicator',  pool: ['red_ondeath_thorns1'] },
    { id: 'red_warchief',    name: 'Red Warchief',    pool: ['red_onplay_buffallies_dmg1'] },
    { id: 'red_cannoneer',   name: 'Red Cannoneer',   pool: ['red_onattack_splash1'] },
  ],
  4: [ // Orange
    { id: 'orange_colossus',   name: 'Orange Colossus',   pool: ['onplay_dmg2'] },
    { id: 'orange_devastator', name: 'Orange Devastator', pool: ['orange_onplay_execute'] },
    { id: 'orange_juggernaut', name: 'Orange Juggernaut', pool: ['orange_onplay_scaledmg'] },
    { id: 'orange_reaper',     name: 'Orange Reaper',     pool: ['orange_ondeath_dmg4'] },
    { id: 'orange_sentinel',   name: 'Orange Sentinel',   pool: ['orange_onplay_refreshall'] },
  ],
};

let _uid = 0;
function nextId() { return 'c' + (++_uid); }

function makeUnitCardFromArchetype(tier, archetype, rng, forcedAbility) {
  const t = TIERS[tier];
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

function makeUnitCard(tier, rng, forcedAbility) {
  const archetype = rng.pick(UNIT_ARCHETYPES[tier]);
  return makeUnitCardFromArchetype(tier, archetype, rng, forcedAbility);
}

// v2.2: builds a specific archetype by id (used by the deck builder, where
// the player has chosen exactly which named cards - of any tier - go into
// their deck). Returns null for an unrecognized id so callers can fall
// back safely instead of crashing a match.
function makeUnitCardById(archetypeId, rng, forcedAbility) {
  for (let tier = 1; tier <= 4; tier++) {
    const archetype = UNIT_ARCHETYPES[tier].find(a => a.id === archetypeId);
    if (archetype) return makeUnitCardFromArchetype(tier, archetype, rng, forcedAbility);
  }
  return null;
}

// Spells target board cards directly, chips modify a card's stats. Both are
// available and usable from the very start of the match (not part of the
// 12-card unit deck). Every effect below is mechanically distinct from
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
  { id: 'frostbolt', kind: 'spell', name: 'Frost Bolt', text: 'Deal 2 damage to target card and permanently reduce its DMG by 1.', dmg: 2, weakenDmg: 1 },
  { id: 'warcry', kind: 'spell', name: 'War Cry', text: "Permanently grant all of target's owner's cards +1 DMG.", buffAllDmg: 1 },
];

const CHIP_DEFS = [
  { id: 'chip_atk', kind: 'chip', name: 'Power Chip', text: '+1 DMG to a card with a free chip slot.', dmg: 1 },
  { id: 'chip_hp', kind: 'chip', name: 'Guard Chip', text: '+2 HP to a card with a free chip slot.', hp: 2 },
  { id: 'chip_twin', kind: 'chip', name: 'Twin Edge Chip', text: '+1 DMG and +1 HP to a card with a free chip slot.', dmg: 1, hp: 1 },
  { id: 'chip_overcharge', kind: 'chip', name: 'Overcharge Chip', text: '+2 DMG to a card with a free chip slot.', dmg: 2 },
  { id: 'chip_fortify', kind: 'chip', name: 'Fortify Chip', text: '+3 HP to a card with a free chip slot.', hp: 3 },
  { id: 'chip_lifeblood', kind: 'chip', name: 'Lifeblood Chip', text: 'Whenever this card lands an attack, it heals itself 1 hp.', lifesteal: 1 },
  { id: 'chip_vampiric', kind: 'chip', name: 'Vampiric Chip', text: 'Whenever this card lands an attack, it heals itself 2 hp.', lifesteal: 2 },
  { id: 'chip_barrier', kind: 'chip', name: 'Barrier Chip', text: '+1 bonus defense charge to a card with a free chip slot.', bonusDefend: 1 },
  { id: 'chip_reflect', kind: 'chip', name: 'Reflect Chip', text: 'Whenever this card takes damage from an attack, it deals 1 dmg back to the attacker.', reflect: 1 },
  { id: 'chip_focus', kind: 'chip', name: 'Focus Chip', text: '+2 DMG but -1 HP to a card with a free chip slot.', dmg: 2, hp: -1 },
];

function makeSpellOrChip(def) {
  return { ...def, id: nextId(), defId: def.id };
}

// ---- Deck building ---------------------------------------------------------
// v2.2: `config.unitIds`, if given, is a player-chosen list of exactly 12
// archetype ids of ANY tier (see the deck builder in main.js, which only
// ever offers archetypes the player owns - Blues are always owned for
// free). Placement still only ever allows Blue (enforced in `placeCard` in
// game.js) - a higher-tier pick just means that specific named card can
// still be sitting in the deck as a "blueprint": merging Blues (or fusing
// further) into its exact tier consumes it and uses its name/ability for
// the result. v3.0: there is no hand/draw step anymore - every one of these
// 12 units is visible and available to place or use as a merge blueprint
// from the very first round. Without a config (e.g. the bot's deck), a
// weighted random spread across all four tiers is used instead, so bot
// matches still show off named higher-tier archetypes.
const RANDOM_DECK_TIER_WEIGHTS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3]; // 9 blue, 2 green, 1 red - kept Blue-heavy so a full-board opening placement doesn't clog on unplaceable blueprints

function buildDeck(rng, config) {
  let units;
  if (config && Array.isArray(config.unitIds) && config.unitIds.length === 12) {
    units = config.unitIds.map(id => makeUnitCardById(id, rng)).filter(Boolean);
    while (units.length < 12) units.push(makeUnitCard(1, rng)); // safety net for a stale/unknown id
  } else {
    units = RANDOM_DECK_TIER_WEIGHTS.map(tier => makeUnitCard(tier, rng));
  }
  units = rng.shuffle(units);

  const spellPool = (config && Array.isArray(config.spellIds) && config.spellIds.length === 4)
    ? config.spellIds.map(id => SPELL_DEFS.find(s => s.id === id)).filter(Boolean)
    : rng.shuffle(SPELL_DEFS.concat(SPELL_DEFS)).slice(0, 4);
  const chipPool = (config && Array.isArray(config.chipIds) && config.chipIds.length === 2)
    ? config.chipIds.map(id => CHIP_DEFS.find(c => c.id === id)).filter(Boolean)
    : rng.shuffle(CHIP_DEFS.concat(CHIP_DEFS)).slice(0, 2);

  return {
    units,                                            // all 12 unit cards, available from the very start
    spells: spellPool.map(makeSpellOrChip),            // exactly 4 spells, available from game start
    chips: chipPool.map(makeSpellOrChip),              // exactly 2 chips, available from game start
  };
}

function chipSlotsFree(card) {
  const used = card.chipsAttached ? card.chipsAttached.length : 0;
  return Math.max(0, card.sp - used);
}

function cardHasChip(card, chipDefId) {
  return !!(card.chipsAttached && card.chipsAttached.includes(chipDefId));
}

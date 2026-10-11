// ---- Tier / color definitions -------------------------------------------
// Tier 1 = Blue, 2 = Green, 3 = Red, 4 = Orange (max tier).
// Defense charges per tier: Blue is unlimited, Green gets exactly one
// block, and Red/Orange can no longer defend at all.
const TIERS = {
  1: { name: 'Blue',   hex: '#3E7CB1', hp: 1, dmg: 1, sp: 1, defends: Infinity },
  2: { name: 'Green',  hex: '#4C9A5B', hp: 2, dmg: 2, sp: 3, defends: 1 },
  3: { name: 'Red',    hex: '#C1443C', hp: 3, dmg: 3, sp: 5, defends: 0 },
  4: { name: 'Orange', hex: '#E08A2C', hp: 4, dmg: 4, sp: 9, defends: 0 },
  5: { name: 'Boss',   hex: '#9333ea', hp: 50, dmg: 8, sp: 5, defends: 2 },
};

// ---- BOSS DEFINITIONS & BOSS CARDS (Tiers 1-5, 20 Levels per Tier) --------------
const BOSS_DEFINITIONS = {
  1: {
    floor: 1,
    tier: 1,
    name: 'Barbod',
    avatar: '🌪️',
    taunt: "Feel the fury of the blinding sandstorm! You won't survive Tier 1!",
    bossCard: {
      archetypeId: 'boss_barbod',
      kind: 'unit',
      tier: 5,
      name: 'Barbod',
      hp: 50,
      maxHp: 50,
      dmg: 6,
      sp: 5,
      ability: 'orange_onplay_scaledmg',
      isBossCard: true,
      isBoss: true
    },
    bossModifier: {
      id: 'boss_iron_wall',
      name: 'Boss Aura: Dust Storm',
      icon: '🌪️',
      tag: 'BOSS',
      desc: 'The Barbod conjures a blinding vortex! Gains +2 bonus defense charges and scales +1 DMG each turn.'
    }
  },
  2: {
    floor: 2,
    tier: 2,
    name: 'Conquest',
    avatar: '⚔️',
    taunt: "I am Conquest! All before me fall and submit to the Colosseum!",
    bossCard: {
      archetypeId: 'boss_conquest',
      kind: 'unit',
      tier: 5,
      name: 'Conquest',
      hp: 60,
      maxHp: 60,
      dmg: 7,
      sp: 5,
      ability: 'red_onattack_doublestrike',
      isBossCard: true,
      isBoss: true
    },
    bossModifier: {
      id: 'boss_conquest_aura',
      name: 'Boss Aura: Blood Arena of Conquest',
      icon: '⚔️',
      tag: 'BOSS',
      desc: 'Conquest strikes twice per combat phase and gains +1 ATK whenever any card falls in battle.'
    }
  },
  3: {
    floor: 3,
    tier: 3,
    name: 'Charlie',
    avatar: '🎩',
    taunt: "You made it to the Shadow Trench, but you won't leave. Charlie never loses.",
    bossCard: {
      archetypeId: 'boss_charlie',
      kind: 'unit',
      tier: 5,
      name: 'Charlie',
      hp: 72,
      maxHp: 72,
      dmg: 8,
      sp: 5,
      ability: 'orange_onplay_soulharvest',
      isBossCard: true,
      isBoss: true
    },
    bossModifier: {
      id: 'boss_charlie_aura',
      name: 'Boss Aura: Phantom Shadow Harvest',
      icon: '🌑',
      tag: 'BOSS',
      desc: 'Charlie feeds on fallen cards (+1 DMG per death) and shrouds his board in an elusive shadow mist.'
    }
  },
  4: {
    floor: 4,
    tier: 4,
    name: 'Renegade Raider',
    avatar: '🪓',
    taunt: "I've raided galaxies, kid! Renegade Raider takes no prisoners!",
    bossCard: {
      archetypeId: 'boss_renegade_raider',
      kind: 'unit',
      tier: 5,
      name: 'Renegade Raider',
      hp: 85,
      maxHp: 85,
      dmg: 9,
      sp: 5,
      ability: 'red_onplay_dmgall1',
      isBossCard: true,
      isBoss: true
    },
    bossModifier: {
      id: 'boss_renegade_aura',
      name: 'Boss Aura: Crimson Raider Fury',
      icon: '🩸',
      tag: 'BOSS',
      desc: 'Renegade Raider unleashes explosive crossfire! Deals 2 splash damage and gains +2 ATK on being attacked.'
    }
  },
  5: {
    floor: 5,
    tier: 5,
    name: 'OMEGA SUPER DUPER ULTRA EPIC LEGENDARY BOSS OF ALL DOOM',
    avatar: '👑⚡',
    taunt: "BEHOLD! I AM THE OMEGA SUPER DUPER ULTRA EPIC LEGENDARY BOSS OF ALL DOOM! TREMBLE BEFORE MY SUPREME MIGHT!",
    bossCard: {
      archetypeId: 'boss_omega_doom',
      kind: 'unit',
      tier: 5,
      name: 'OMEGA SUPER DUPER ULTRA EPIC LEGENDARY BOSS OF ALL DOOM',
      hp: 120,
      maxHp: 120,
      dmg: 12,
      sp: 5,
      ability: 'orange_onplay_alphastrike',
      isBossCard: true,
      isBoss: true,
      isOmegaBoss: true
    },
    bossModifier: {
      id: 'boss_omega_doom_aura',
      name: 'Boss Aura: APOCALYPTIC OMEGA DOOM',
      icon: '💥⚡',
      tag: 'OMEGA BOSS',
      desc: 'The Supreme Overlord! Instantly executes weakest foe, burns opposing cards for 2 DMG each round, and takes 30% reduced damage!'
    }
  }
};

// ---- TIER BOSS REGISTRY (Final level of each Tier: Levels 4, 8, 12, 16, 20) ----
const TIER_BOSS_TEMPLATES = {
  4: {
    tierNumber: 1,
    name: 'Ignis the Cinder Warden',
    avatar: '🌋',
    taunt: "None shall breach the Obsidian Gates! Turn to ash, intruder!",
    bossCard: {
      archetypeId: 'boss_ignis_warden',
      kind: 'unit',
      tier: 5,
      name: 'Ignis',
      baseHp: 28,
      baseDmg: 4,
      sp: 3,
      ability: 'orange_onplay_scaledmg',
      isBossCard: true,
      isBoss: true
    },
    bossModifier: {
      id: 'boss_cinder_warden',
      name: 'Boss Aura: Molten Shell',
      icon: '🌋',
      tag: 'BOSS',
      desc: 'Ignis radiates searing magma! Grants +1 Shield and deals 1 burn damage to attackers.'
    }
  },
  8: {
    tierNumber: 2,
    name: 'Valakor the Dread Champion',
    avatar: '💀',
    taunt: "Step into the Colosseum, challenger! Your blood will paint these stones!",
    bossCard: {
      archetypeId: 'boss_valakor_champion',
      kind: 'unit',
      tier: 5,
      name: 'Valakor',
      baseHp: 34,
      baseDmg: 5,
      sp: 4,
      ability: 'red_onattack_doublestrike',
      isBossCard: true,
      isBoss: true
    },
    bossModifier: {
      id: 'boss_colosseum_champion',
      name: 'Boss Aura: Blood Arena',
      icon: '⚔️',
      tag: 'BOSS',
      desc: 'Valakor strikes twice per combat phase and gains +1 ATK when an enemy falls.'
    }
  },
  12: {
    tierNumber: 3,
    name: 'Vesper the Shadow Sovereign',
    avatar: '🗡️',
    taunt: "The trench swallows all light. You cannot strike what you cannot see!",
    bossCard: {
      archetypeId: 'boss_vesper_shadow',
      kind: 'unit',
      tier: 5,
      name: 'Vesper',
      baseHp: 40,
      baseDmg: 6,
      sp: 4,
      ability: 'orange_onplay_soulharvest',
      isBossCard: true,
      isBoss: true
    },
    bossModifier: {
      id: 'boss_shadow_sovereign',
      name: 'Boss Aura: Void Shroud',
      icon: '🌑',
      tag: 'BOSS',
      desc: 'Vesper shrouds the battlefield in shadow. All player attacks have a 25% chance to miss.'
    }
  },
  16: {
    tierNumber: 4,
    name: 'Gorgon the Blood Titan',
    avatar: '🩸',
    taunt: "The Blood Bastion never yields! Your bones will pave my fortress!",
    bossCard: {
      archetypeId: 'boss_gorgon_blood',
      kind: 'unit',
      tier: 5,
      name: 'Gorgon',
      baseHp: 46,
      baseDmg: 7,
      sp: 5,
      ability: 'red_onplay_dmgall1',
      isBossCard: true,
      isBoss: true
    },
    bossModifier: {
      id: 'boss_blood_bastion',
      name: 'Boss Aura: Crimson Fortress',
      icon: '🩸',
      tag: 'BOSS',
      desc: 'Gorgon retaliates when struck, inflicting 1 bleeding splash damage to all adjacent player units.'
    }
  }
};

function isTierBossLevel(level) {
  const l = Number(level) || 1;
  return l === 20;
}

function getTierBossDefinition(floor, level) {
  const f = Math.max(1, Number(floor) || 1);
  return getBossDefinition(f);
}

function isBossFloor(floor) {
  return typeof floor === 'number' && floor > 0;
}

function getBossDefinition(floor) {
  const f = Math.max(1, Number(floor) || 1);
  const keys = [1, 2, 3, 4, 5];
  const templateKey = BOSS_DEFINITIONS[f] ? f : (keys[(f - 1) % keys.length] || 1);
  const template = BOSS_DEFINITIONS[templateKey] || BOSS_DEFINITIONS[1] || BOSS_DEFINITIONS[10];
  const scale = 1 + (f - 1) * 0.12;
  const scaledHp = Math.round(template.bossCard.hp * scale);
  const scaledDmg = Math.round(template.bossCard.dmg * (1 + (f - 1) * 0.06));
  return {
    floor: f,
    name: template.name,
    avatar: template.avatar,
    taunt: template.taunt,
    bossCard: {
      ...template.bossCard,
      hp: scaledHp,
      maxHp: scaledHp,
      dmg: scaledDmg,
      isBossCard: true,
      isBoss: true
    },
    bossModifier: { ...template.bossModifier }
  };
}

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
  green_onplay_discard1:   { id: 'green_onplay_discard1', label: "On placement: sabotages the enemy deck by removing a card." },

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

  // v3.11: 9 new abilities (3 per non-Blue tier), each built around a
  // mechanic no existing card touches - a damage-negating Ward, stealing an
  // enemy card outright, permanent chip-slot growth, a burn (damage-over-
  // time) effect, an HP-threshold board wipe, attacking twice per swing, a
  // stat that scales with the match's total death count, dying into two
  // fresh Blue cards, and an immediate bonus strike on placement. None of
  // these overlap with the flat damage/heal/buff patterns above.
  green_onplay_ward1:      { id: 'green_onplay_ward1', label: 'On placement: gains a Ward that completely blocks the next instance of damage it would take.' },
  green_onplay_stealcard:  { id: 'green_onplay_stealcard', label: "On placement: steals the enemy's weakest Blue card onto your board, if you have room." },
  green_onplay_chipslot1:  { id: 'green_onplay_chipslot1', label: 'On placement: permanently gains +1 chip slot.' },
  red_onplay_burn2:        { id: 'red_onplay_burn2', label: 'On placement: burns a random enemy card, dealing 1 dmg at the start of each of the next 2 rounds.' },
  red_onplay_purge_weak:   { id: 'red_onplay_purge_weak', label: 'On placement: destroys every enemy card with 2 or less max HP.' },
  red_onattack_doublestrike:{ id: 'red_onattack_doublestrike', label: "This card's attacks strike twice." },
  orange_onplay_soulharvest:{ id: 'orange_onplay_soulharvest', label: 'On placement: gains +1 DMG for every card that has died so far this match (both sides combined).' },
  orange_ondeath_rebirth2: { id: 'orange_ondeath_rebirth2', label: 'On death: leaves behind 2 Blue cards on your board in its place, if you have room.' },
  orange_onplay_alphastrike:{ id: 'orange_onplay_alphastrike', label: 'On placement: immediately deals its DMG to a random enemy card, on top of attacking normally this round.' },
  restore_spell: { id: 'restore_spell', label: 'On placement: restore 1 used spell card to your hand.' },
  restore_chip:  { id: 'restore_chip', label: 'On placement: restore 1 used chip card to your hand.' },
  add_random_blue: { id: 'add_random_blue', label: 'On placement: add a random Blue card to your hand.' },
  jones_freespell: { id: 'jones_freespell', label: 'On placement: use 1 spell of your choice for free without it going from your deck.' },
};

// ---- Unit archetypes -------------------------------------------------------
// Each tier has 5 named archetypes, and every single one (Blue excluded)
// has exactly one guaranteed, unique ability that belongs to it and no
// other card in the game - see the v3.2 restoration note above ABILITIES.
// Blue's pools are all ['none'] only - Blue cards can never roll a special
// ability (see fix note below).
const UNIT_ARCHETYPES = {
  1: [ // Blue (All Blues have 1 SP)
    { id: 'blue_sprite',   name: 'Sprite',   sp: 1, pool: ['none'] },
    { id: 'blue_recruit',  name: 'Recruit',  sp: 1, pool: ['none'] },
    { id: 'blue_scout',    name: 'Scout',    sp: 1, pool: ['none'] },
    { id: 'blue_cadet',    name: 'Cadet',    sp: 1, pool: ['none'] },
    { id: 'blue_drifter',  name: 'Drifter',  sp: 1, pool: ['none'] },
    { id: 'blue_vanguard', name: 'Vanguard', sp: 1, pool: ['none'] },
    { id: 'blue_herald',   name: 'Herald',   sp: 1, pool: ['none'] },
    { id: 'blue_wisp',     name: 'Wisp',     sp: 1, pool: ['none'] },
  ],
  2: [ // Green (Scaling 2 - 4 SP)
    { id: 'green_warden',       name: 'Warden',        sp: 3, pool: ['onplay_heal2'] },
    { id: 'green_chaplain',     name: 'Chaplain',      sp: 2, pool: ['green_onplay_healall1'] },
    { id: 'green_pathfinder',   name: 'Pathfinder',    sp: 3, pool: ['green_ondeath_draw1'] },
    { id: 'green_bulwark',      name: 'Bulwark',       sp: 4, pool: ['green_onplay_selftoughen1'] },
    { id: 'green_saboteur',     name: 'Saboteur',      sp: 3, pool: ['green_onplay_discard1'] },
    { id: 'green_warden_ii',    name: 'Sentinel',      sp: 4, pool: ['green_onplay_ward1'] },
    { id: 'green_footpad',      name: 'Footpad',       sp: 3, pool: ['green_onplay_stealcard'] },
    { id: 'green_tinkerer',     name: 'Tinkerer',      sp: 4, pool: ['green_onplay_chipslot1'] },
    { id: 'green_aether_glider', name: 'Aether Glider', sp: 3, pool: ['onplay_heal2'] },
    { id: 'green_verdant_titan', name: 'Verdant Titan', sp: 4, pool: ['green_onplay_selftoughen1'] },
  ],
  3: [ // Red (Scaling 4 - 6 SP)
    { id: 'red_wraith',      name: 'Wraith',      sp: 5, pool: ['onattack_pierce'] },
    { id: 'red_firestarter', name: 'Firestarter', sp: 5, pool: ['red_onplay_dmgall1'] },
    { id: 'red_vindicator',  name: 'Vindicator',  sp: 6, pool: ['red_ondeath_thorns1'] },
    { id: 'red_warchief',    name: 'Warchief',    sp: 5, pool: ['red_onplay_buffallies_dmg1'] },
    { id: 'red_cannoneer',   name: 'Cannoneer',   sp: 6, pool: ['red_onattack_splash1'] },
    { id: 'red_immolator',   name: 'Immolator',   sp: 5, pool: ['red_onplay_burn2'] },
    { id: 'red_purger',      name: 'Purger',      sp: 6, pool: ['red_onplay_purge_weak'] },
    { id: 'red_duelist',     name: 'Duelist',     sp: 4, pool: ['red_onattack_doublestrike'] },
    { id: 'red_hyperdrive_drake', name: 'Hyperdrive Drake', sp: 5, pool: ['red_onplay_dmgall1'] },
    { id: 'red_cyber_valkyrie',   name: 'Cyber Valkyrie',   sp: 6, pool: ['red_onplay_buffallies_dmg1'] },
    { id: 'red_solar_phoenix',    name: 'Solar Phoenix',    sp: 6, pool: ['restore_chip'] },
    { id: 'red_nebula_valkyrie',  name: 'Nebula Valkyrie',  sp: 6, pool: ['restore_spell'] },
  ],
  4: [ // Orange (Scaling 7 - 9 SP, max 9)
    { id: 'orange_colossus',   name: 'Colossus',   sp: 8, pool: ['onplay_dmg2'] },
    { id: 'orange_devastator', name: 'Devastator', sp: 9, pool: ['orange_onplay_execute'] },
    { id: 'orange_juggernaut', name: 'Juggernaut', sp: 9, pool: ['orange_onplay_scaledmg'] },
    { id: 'orange_reaper',     name: 'Reaper',     sp: 8, pool: ['orange_ondeath_dmg4'] },
    { id: 'orange_sentinel',   name: 'Vanguard',   sp: 7, pool: ['orange_onplay_refreshall'] },
    { id: 'orange_harvester',  name: 'Harvester',  sp: 9, pool: ['orange_onplay_soulharvest'] },
    { id: 'orange_phoenix',    name: 'Phoenix',    sp: 8, pool: ['orange_ondeath_rebirth2'] },
    { id: 'orange_warlord',    name: 'Warlord',    sp: 9, pool: ['orange_onplay_alphastrike'] },
    { id: 'orange_chronos_sentinel', name: 'Chronos Sentinel', sp: 8, pool: ['orange_onplay_refreshall'] },
    { id: 'orange_singularity_devourer', name: 'Void Entity', sp: 9, pool: ['add_random_blue'] },
    { id: 'orange_quantum_behemoth', name: 'Quantum Colossus', sp: 9, pool: ['orange_onplay_scaledmg'] },
    { id: 'orange_apex_sovereign_unit', name: 'Jonesy', sp: 9, pool: ['jones_freespell'] },
  ],
};

let _uid = 0;
function nextId() { return 'c' + (++_uid); }

function makeUnitCardFromArchetype(tier, archetype, rng, forcedAbility) {
  const t = TIERS[tier];
  let ability = (forcedAbility && archetype.pool.includes(forcedAbility)) ? forcedAbility : (archetype.pool.length > 1 ? rng.pick(archetype.pool) : archetype.pool[0]);
  const spVal = archetype.sp !== undefined ? archetype.sp : t.sp;
  const card = {
    id: nextId(),
    archetypeId: archetype.id,
    kind: 'unit',
    tier,
    name: archetype.name,
    hp: t.hp,
    maxHp: t.hp,
    dmg: t.dmg,
    sp: spVal,
    ability,
    defendChargesUsed: 0,   // how many times this card has already defended
    canAttackAgain: false,  // set when a queued attack must resolve next cycle
    pendingAttackTargetId: null,
  };
  return card;
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
  { id: 'splashbolt', kind: 'spell', name: 'Splash Bolt', text: 'Deal 2 damage to target card, then 1 splash damage to a second random enemy card.', dmg: 2, splash: 1 },
  { id: 'massmend', kind: 'spell', name: 'Mass Mend', text: "Heal all of target's owner's cards 2 hp.", healAll: 2 },
  { id: 'weaken', kind: 'spell', name: 'Weaken', text: "Permanently reduce target card's DMG by 2 (minimum 0).", weakenDmg: 2 },
  { id: 'adrenaline', kind: 'spell', name: 'Adrenaline', text: 'Deal 1 damage to target card, but permanently grant it +3 DMG.', dmg: 1, buffDmg: 3 },
  { id: 'frostbolt', kind: 'spell', name: 'Frost Bolt', text: 'Deal 2 damage to target card and permanently reduce its DMG by 1.', dmg: 2, weakenDmg: 1 },
  { id: 'warcry', kind: 'spell', name: 'War Cry', text: "Permanently grant all of target's owner's cards +1 DMG.", buffAllDmg: 1 },
  { id: 'chainlightning', kind: 'spell', name: 'Chain Lightning', text: 'Deal 1 damage to all cards on the board, then heal all of your own cards for 2. (Can be used twice)', chainLightning: true },
  { id: 'suddendeath', kind: 'spell', name: 'Sudden Death', text: 'During 1 round of attack all cards on the board have 1 HP.', suddenDeath: true },
  { id: 'hack', kind: 'spell', name: 'Hack', text: 'Deal 2 DMG to enemy card, Heal yours for 1.', hack: true },
  { id: 'orange', kind: 'spell', name: 'Orange', text: 'Heal target card to full HP. (Sacrifice 1 Spell card)', orange: true },
  { id: 'rocketboom', kind: 'spell', name: 'Rocket Boom', text: 'Chosen card now has 1 HP. (One use)', rocketBoom: true },
  { id: 'sanctioned', kind: 'spell', name: 'Sanctioned', text: 'Target card cannot defend for entire match. (Infinite use) (sacrifice 1 Spell card)', sanctioned: true },
  { id: 'zap', kind: 'spell', name: 'Zap!', text: 'Deal 5 damage to an enemy card.', zap: true, dmg: 5 },
  { id: 'allaura', kind: 'spell', name: 'All Aura', text: 'Enemy card cannot attack or defend for 3 turns. (Can be used twice)', allAura: true },
  { id: 'remainsmask', kind: 'spell', name: 'Remains Mask', text: 'Sacrifice 1 Red Card on board to fill hand with Sacrifice Man spells. (1x Use)', remainsMask: true, usesLeft: 1 },
  { id: 'sacrificeman', kind: 'spell', name: 'Sacrifice Man', text: 'Does nothing on its own. Exists to be sacrificed by other spells.', sacrificeMan: true },
  { id: 'supremeshirt', kind: 'spell', name: 'Supreme Shirt', text: '+2 HP, DMG and SP to Chosen Card.', supremeShirt: true },
  { id: 'revivespell', kind: 'spell', name: 'Revive Spell', text: 'Revives 1 dead card from your graveyard onto your board.', reviveSpell: true },
  { id: 'skeletonstaff', kind: 'spell', name: 'Skeleton Staff', text: 'Selected card has 1 HP, 1 ATK, 1 SP and cannot use chips.', skeletonStaff: true },
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
// 2 of each tier (1, 2, 3, 4 = 8 cards) + 4 extra blue cards (total 12 cards)
const RANDOM_DECK_TIER_WEIGHTS = [1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4];
const RANDOM_TOWER_DECK_TIER_WEIGHTS = [1, 1, 1, 1, 2, 2, 3, 4];

function buildDeck(rng, config, playerKey = 'p') {
  let units;
  const isTower = (typeof trialTowerActive !== 'undefined' && trialTowerActive) || (config && config.isTrialTower);
  const targetUnits = isTower ? 8 : 12;
  const targetSpells = isTower ? 3 : 4;
  const targetChips = 2;

  let currentTowerFloor = 1;
  let currentTowerLevel = 1;
  let isBossChamber = false;
  if (typeof loadRoguelikeRun === 'function') {
    const r = loadRoguelikeRun();
    if (r) {
      currentTowerFloor = r.floor || 1;
      currentTowerLevel = r.level || 1;
      isBossChamber = (typeof isTierBossLevel === 'function' && isTierBossLevel(currentTowerLevel)) || (r.currentChamber && r.currentChamber.type === 'boss');
    }
  } else if (typeof loadTrialTowerState === 'function') {
    const ts = loadTrialTowerState();
    if (ts && ts.floor) currentTowerFloor = ts.floor;
    if (ts && ts.level) currentTowerLevel = ts.level;
    isBossChamber = (typeof isTierBossLevel === 'function' && isTierBossLevel(currentTowerLevel));
  }
  const isBossMatch = isTower && (isBossChamber || (typeof isTierBossLevel === 'function' && isTierBossLevel(currentTowerLevel)) || Boolean(config?.isBossMatch));
  const bossDef = isBossMatch ? (typeof getTierBossDefinition === 'function' ? getTierBossDefinition(currentTowerFloor, currentTowerLevel) : getBossDefinition(currentTowerFloor)) : null;

  if (config && Array.isArray(config.unitIds) && config.unitIds.length > 0) {
    units = config.unitIds.slice(0, targetUnits).map(id => makeUnitCardById(id, rng)).filter(Boolean);
    while (units.length < targetUnits) units.push(makeUnitCard(1, rng));
  } else if (playerKey === 'bot') {
    const allNonBossArchetypes = [];
    for (let t = 1; t <= 4; t++) {
      if (UNIT_ARCHETYPES[t]) {
        UNIT_ARCHETYPES[t].forEach(arch => allNonBossArchetypes.push({ tier: t, arch }));
      }
    }
    const shuffledArchetypes = rng.shuffle(allNonBossArchetypes);
    units = [];
    for (let i = 0; i < targetUnits && i < shuffledArchetypes.length; i++) {
      units.push(makeUnitCardFromArchetype(shuffledArchetypes[i].tier, shuffledArchetypes[i].arch, rng));
    }
    while (units.length < targetUnits) {
      const fallback = rng.pick(allNonBossArchetypes);
      units.push(makeUnitCardFromArchetype(fallback.tier, fallback.arch, rng));
    }
  } else {
    const weights = isTower ? RANDOM_TOWER_DECK_TIER_WEIGHTS : RANDOM_DECK_TIER_WEIGHTS;
    units = weights.map(tier => makeUnitCard(tier, rng));
  }
  units = rng.shuffle(units);

  // If this is a Boss match and building the bot deck, inject the Boss Card at the front!
  if (playerKey === 'bot' && bossDef) {
    const bossCard = { ...bossDef.bossCard, defendChargesUsed: 0, canAttackAgain: false, pendingAttackTargetId: null };
    // Replace the first unit or insert Boss Card at position 0
    units = [bossCard, ...units.slice(0, targetUnits - 1)];
  }

  if (isTower && playerKey === 'bot') {
    const statBonus = Math.floor(currentTowerFloor / 10);
    const bossStatBonus = Math.floor(currentTowerFloor / 5);
    units.forEach(card => {
      if (card) {
        const isBoss = card.isBossCard || card.tier === 5;
        const b = isBoss ? bossStatBonus : statBonus;
        card.hp = (card.hp || 3) + b;
        card.maxHp = (card.maxHp || card.hp) + b;
        card.dmg = (card.dmg || 1) + Math.max(0, Math.floor(b / 2));
      }
    });
  }

  units.forEach((card, i) => {
    card.id = `${playerKey}_u_${i}`;
    card.netId = `${playerKey}_u_${i}`;
  });

  let spellPool;
  if (config && Array.isArray(config.spellIds) && config.spellIds.length > 0) {
    spellPool = config.spellIds.slice(0, targetSpells).map(id => SPELL_DEFS.find(s => s.id === id)).filter(Boolean);
  } else if (playerKey === 'bot') {
    spellPool = rng.shuffle([...SPELL_DEFS]).slice(0, targetSpells);
  } else {
    spellPool = rng.shuffle(SPELL_DEFS.concat(SPELL_DEFS)).slice(0, targetSpells);
  }
  while (spellPool.length < targetSpells) {
    const fallback = SPELL_DEFS[Math.floor(rng.next() * SPELL_DEFS.length)];
    if (fallback) spellPool.push(fallback);
  }

  let chipPool;
  if (config && Array.isArray(config.chipIds) && config.chipIds.length > 0) {
    chipPool = config.chipIds.slice(0, targetChips).map(id => CHIP_DEFS.find(c => c.id === id)).filter(Boolean);
  } else if (playerKey === 'bot') {
    chipPool = rng.shuffle([...CHIP_DEFS]).slice(0, targetChips);
  } else {
    chipPool = rng.shuffle(CHIP_DEFS.concat(CHIP_DEFS)).slice(0, targetChips);
  }
  while (chipPool.length < targetChips) {
    const fallback = CHIP_DEFS[Math.floor(rng.next() * CHIP_DEFS.length)];
    if (fallback) chipPool.push(fallback);
  }

  const spells = spellPool.map((def, i) => {
    const s = makeSpellOrChip(def);
    s.id = `${playerKey}_s_${i}`;
    s.netId = `${playerKey}_s_${i}`;
    return s;
  });

  const chips = chipPool.map((def, i) => {
    const c = makeSpellOrChip(def);
    c.id = `${playerKey}_c_${i}`;
    c.netId = `${playerKey}_c_${i}`;
    return c;
  });

  return { units, spells, chips };
}

function chipSlotsFree(card) {
  if (!card || card.cannotUseChips) return 0;
  const used = card.chipsAttached ? card.chipsAttached.length : 0;
  return Math.max(0, (card.sp !== undefined ? card.sp : (TIERS[card.tier]?.sp || 0)) - used);
}

function cardHasChip(card, chipDefId) {
  return !!(card.chipsAttached && card.chipsAttached.includes(chipDefId));
}

// ---- Player Level & XP Foundation ----------------------------------------
var PLAYER_XP_KEY = 'mehrbod_player_xp_v1';
function loadPlayerXP() {
  try { const n = Number(localStorage.getItem(PLAYER_XP_KEY)); return Number.isFinite(n) && n >= 0 ? n : 0; }
  catch (e) { return 0; }
}
function savePlayerXP(n) { try { localStorage.setItem(PLAYER_XP_KEY, String(Math.max(0, Math.floor(n)))); } catch (e) {} }
function xpNeededForLevel(level) { return 100 + (level - 1) * 40; }
function playerLevelFromXP(xp) {
  let level = 1, remaining = Number.isFinite(xp) ? xp : 0;
  while (remaining >= xpNeededForLevel(level)) { remaining -= xpNeededForLevel(level); level++; }
  return { level, into: remaining, need: xpNeededForLevel(level) };
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const PLAYER_NAME_KEY = 'mehrbod-cards-player-name';
function loadPlayerName() {
  try { return (localStorage.getItem(PLAYER_NAME_KEY) || '').trim(); } catch (e) { return ''; }
}
function savePlayerName(name) {
  const cleaned = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!cleaned) return false;
  try { localStorage.setItem(PLAYER_NAME_KEY, cleaned); } catch (e) { return false; }
  return true;
}

function validateDeckConfigIntegrity(config) {
  if (!config || typeof config !== 'object') {
    return { valid: false, reason: 'Invalid deck configuration payload structure' };
  }

  // 1. Validate units
  if (!config.units || typeof config.units !== 'object') {
    return { valid: false, reason: 'Missing deck units configuration' };
  }

  let totalUnits = 0;
  for (const [idStr, count] of Object.entries(config.units)) {
    const archId = Number(idStr);
    const arch = typeof findArchetypeById === 'function' ? findArchetypeById(archId) : null;
    if (!arch) {
      return { valid: false, reason: `Unknown unit archetype ID: ${idStr}` };
    }
    const num = Number(count);
    if (!Number.isInteger(num) || num <= 0) {
      return { valid: false, reason: `Invalid unit count for ${arch.name}` };
    }
    // Tier max copies check
    const maxAllowed = arch.tier === 1 ? 4 : arch.tier === 2 ? 3 : arch.tier === 3 ? 2 : 1;
    if (num > maxAllowed) {
      return { valid: false, reason: `Exceeded tier ${arch.tier} limit (${num}/${maxAllowed}) for ${arch.name}` };
    }
    totalUnits += num;
  }

  if (totalUnits !== 10) {
    return { valid: false, reason: `Deck must contain exactly 10 units (found ${totalUnits})` };
  }

  // 2. Validate Spells
  if (!Array.isArray(config.spells)) {
    return { valid: false, reason: 'Invalid spells list format' };
  }
  if (config.spells.length !== 3) {
    return { valid: false, reason: `Deck must contain exactly 3 spells (found ${config.spells.length})` };
  }
  for (const sId of config.spells) {
    if (typeof SPELL_DEFS !== 'undefined' && !SPELL_DEFS[sId]) {
      return { valid: false, reason: `Unknown spell ID: ${sId}` };
    }
  }

  // 3. Validate Chips
  if (!Array.isArray(config.chips)) {
    return { valid: false, reason: 'Invalid chips list format' };
  }
  for (const cId of config.chips) {
    if (typeof CHIP_DEFS !== 'undefined' && !CHIP_DEFS[cId]) {
      return { valid: false, reason: `Unknown chip ID: ${cId}` };
    }
  }

  return { valid: true };
}

const PROFILE_GRADIENT_KEY = 'mehrbod-cards-profile-gradient';
const PROFILE_GRADIENT_PRESETS = [
  { name: 'Astral Void', c1: '#8b5cf6', c2: '#06b6d4', angle: 135 },
  { name: 'Solar Flare', c1: '#f97316', c2: '#ef4444', angle: 135 },
  { name: 'Cyber Neon', c1: '#06b6d4', c2: '#3b82f6', angle: 135 },
  { name: 'Emerald Mint', c1: '#10b981', c2: '#059669', angle: 135 },
  { name: 'Royal Gold', c1: '#eab308', c2: '#ca8a04', angle: 135 },
  { name: 'Neon Rose', c1: '#ec4899', c2: '#8b5cf6', angle: 135 },
  { name: 'Molten Magma', c1: '#dc2626', c2: '#7c2d12', angle: 135 },
  { name: 'Deep Ocean', c1: '#0284c7', c2: '#1e1b4b', angle: 135 },
  { name: 'Twilight Rune', c1: '#6366f1', c2: '#4338ca', angle: 135 },
  { name: 'Pastel Sunset', c1: '#f472b6', c2: '#fb923c', angle: 135 },
  { name: 'Toxic Volt', c1: '#84cc16', c2: '#0d9488', angle: 135 },
  { name: 'Vampire Dark', c1: '#881337', c2: '#1c1917', angle: 135 },
];

function hslToHex(h, s, l) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function loadProfileGradient() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_GRADIENT_KEY) || 'null');
    if (raw && typeof raw === 'object' && raw.c1 && raw.c2) {
      return {
        c1: String(raw.c1),
        c2: String(raw.c2),
        angle: typeof raw.angle === 'number' ? raw.angle : 135
      };
    }
  } catch (e) {}
  return null;
}

function saveProfileGradient(grad) {
  try {
    if (!grad) {
      localStorage.removeItem(PROFILE_GRADIENT_KEY);
    } else {
      localStorage.setItem(PROFILE_GRADIENT_KEY, JSON.stringify({
        c1: grad.c1,
        c2: grad.c2,
        angle: typeof grad.angle === 'number' ? grad.angle : 135
      }));
    }
  } catch (e) {}
}

function profileAvatarColors(name) {
  let hash = 0;
  const safeName = String(name || 'Player');
  for (let i = 0; i < safeName.length; i++) hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 40) % 360;
  return {
    c1: `hsl(${hue1}, 62%, 46%)`,
    c2: `hsl(${hue2}, 62%, 34%)`,
    hex1: hslToHex(hue1, 62, 46),
    hex2: hslToHex(hue2, 62, 34)
  };
}

function getActiveProfileGradient(name, isLocal = false) {
  const localName = (typeof loadPlayerName === 'function' ? loadPlayerName() : '') || 'Player';
  
  // Only apply local player's saved custom gradient if this is explicitly the local player
  if (isLocal || name === 'You') {
    const custom = loadProfileGradient();
    if (custom) {
      return { ...custom, isCustom: true };
    }
    const myColors = profileAvatarColors(localName);
    return {
      c1: myColors.hex1 || '#8b5cf6',
      c2: myColors.hex2 || '#06b6d4',
      angle: 150,
      isCustom: false
    };
  }

  // Remote player / opponent profile gradient:
  const targetName = String(name || 'Opponent');
  // If remote player name is identical to local player's name, add a deterministic offset
  // so the opponent never has the exact same visual colors as the local user
  const effectiveName = (targetName === localName || targetName === 'Player') ? (targetName + '_opp_p2') : targetName;
  const defaultColors = profileAvatarColors(effectiveName);
  return {
    c1: defaultColors.hex1 || '#ec4899',
    c2: defaultColors.hex2 || '#f59e0b',
    angle: 135,
    isCustom: false
  };
}

function getProfileAvatarGradientCss(name, customGrad, isLocal = false) {
  if (customGrad && customGrad.c1 && customGrad.c2) {
    return `linear-gradient(${customGrad.angle || 135}deg, ${customGrad.c1}, ${customGrad.c2})`;
  }
  if (typeof customGrad === 'string' && customGrad.startsWith('linear-gradient')) {
    return customGrad;
  }
  const grad = getActiveProfileGradient(name, isLocal);
  return `linear-gradient(${grad.angle || 135}deg, ${grad.c1}, ${grad.c2})`;
}

if (typeof window !== 'undefined') {
  window.PROFILE_GRADIENT_KEY = PROFILE_GRADIENT_KEY;
  window.PROFILE_GRADIENT_PRESETS = PROFILE_GRADIENT_PRESETS;
  window.loadProfileGradient = loadProfileGradient;
  window.saveProfileGradient = saveProfileGradient;
  window.profileAvatarColors = profileAvatarColors;
  window.getActiveProfileGradient = getActiveProfileGradient;
  window.getProfileAvatarGradientCss = getProfileAvatarGradientCss;
  window.PLAYER_XP_KEY = PLAYER_XP_KEY;
  window.loadPlayerXP = loadPlayerXP;
  window.savePlayerXP = savePlayerXP;
  window.xpNeededForLevel = xpNeededForLevel;
  window.playerLevelFromXP = playerLevelFromXP;
  window.todayKey = todayKey;
  window.PLAYER_NAME_KEY = PLAYER_NAME_KEY;
  window.loadPlayerName = loadPlayerName;
  window.savePlayerName = savePlayerName;
  window.validateDeckConfigIntegrity = validateDeckConfigIntegrity;
}

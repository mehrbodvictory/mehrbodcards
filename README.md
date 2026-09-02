# Mehrbod Cards

A browser card battler with vs-bot practice (5 difficulty levels) and peer-to-peer multiplayer. Pure static site — no backend, no build step.

## Play it

Open `index.html` directly in a browser, or host the folder anywhere static (e.g. GitHub Pages).

## How to play

- Before each match, build a **deck**: 12 units of any tier you own, 4 spells, and 2 chips. Everything you pick is visible and available from round 1 — there's no hand or draw step.
- Only **Blue** cards can be placed directly. Merging requires a matching-tier blueprint (a Green/Red/Orange card) still sitting unused in your deck.
- **Combine mode**: merges are no longer limited to pairs. Tap 🧬 Combine, then tap 2, 3, or 4 of your own cards to select them (or keep using the classic drag-one-card-onto-another gesture for a quick pair merge), then Confirm. Any selection whose tiers sum to 2, 3, or 4 is legal — four Blues can go straight to Orange, three Blues straight to Red, a Blue + Green straight to Orange, and so on — as long as you still have the matching blueprint. The merge consumes that blueprint and uses its name/ability instead of a generic result. Run out of a tier's blueprint and you can never merge into that tier again for the rest of the match — pick some higher-tier cards in the deck builder if you want to fuse up.
- Blue cards regenerate for free on death or merge, but **only** while you still have at least one non-Blue blueprint left in your deck. Once that runs out, Blue stops replenishing for good.
- Each round has a placement phase and an attack phase. Attacks from both players resolve simultaneously once everyone's readied up.
- Defending blocks all damage to that card for the round but forfeits its own attack. Blue defends unlimited times (once unlocked by your first merge), Green once, Red and Orange never.
- You win by reducing the opponent's total cards — deck and board combined — to zero. A 60-round cap guarantees every match ends even in a rare stalemate.
- A first-time player automatically gets a guided tutorial (menu tour + a real practice match) — replay it anytime from "How to play" in the Single Player menu.

## Currency & progression

Everyone starts with 50 **Mehrbod Bux**, and normal spending can never drop below 10. A wager of exactly 10 is allowed when you have exactly 10; losing it leaves you at 10, while winning raises your balance. Earn more by winning wagered matches (Practice vs Bot or Host Match, choosing "Wager Match"). Spend it in the **Mehrbod Shop** on Card Packs (unlock new spells, chips, and unit archetypes — now opened with a real pack-tear + card-flip reveal) or Cosmetics (the Mr Money theme, card sleeves, and more). The **Collection Book** (📖 Collection from the main menu) lets you browse every Card you've discovered — including a completion radar at the top — or switch to Themes. **Quests** (🏆) covers theme unlocks, your Daily Challenge, and Forge Milestones all in one panel. **Stats** (📊, menu footer) covers Battle Stats, the Bux Ledger, and Recent Activity in one panel.

**🎁 Daily Login Reward** (new): open the app on a new calendar day and claim an escalating 7-day reward streak from the "🎁 Daily" link on the main menu footer (it also pops up automatically once a day, after your first-run tutorial). Miss a day and the streak resets to Day 1, but your best streak is remembered. This is separate from the Daily Challenge, which still requires actually finishing a match.

## Multiplayer

Host a match to get a 5-character room code; a friend enters it to join. Peer-to-peer via [PeerJS](https://peerjs.com) (loaded from a CDN) — no server of your own required. The host is authoritative over game state; both sides use a shared seeded RNG plus an exchanged deck config to stay perfectly in sync without shipping full game state over the wire. Merge actions (single-pair drag or multi-card Combine) are sent as one `{ type:'merge', slots:[...] }` action, so both sides always apply the exact same fusion.

## Files

```
index.html            Screens & layout
style.css              Core styling & themes
style-juice.css        Juice pass: pack opening, cosmetic reworks, ripple, daily login UI
js/rng.js              Seeded PRNG shared by both peers
js/cards.js            Card/tier/ability/deck definitions
js/game.js             Rules engine (pure functions over a state object)
js/bot.js              Bot AI, 5 difficulty levels
js/network.js          PeerJS wrapper, host-authoritative sync
js/ui.js               DOM rendering helpers
js/main.js             App controller: screens, input handling, game loop
js/juice.js            Pack-opening flow, meteor shower rework, ripple polish, Daily Login system
js/sound.js            Procedural Web Audio sound engine
```

`style-juice.css` and `js/juice.js` are additive layers loaded after the core files — they override a couple of functions/rules (card pack opening, the meteor shower victory animation, void sleeve styling, cyber neon/abyss/collector polish) and add the Daily Login Reward system, without needing to touch the core `main.js`/`style.css` files directly.

## v3.9 — this build

- **NEW**: opening a Card Pack is now a real pack-opening moment — tear the foil pack open, then flip each card one by one with tier-colored glow, sound, and sparkle bursts, instead of an instant toast (Pokemon / PVZ: Garden Warfare 2-style reveal).
- **NEW progression system**: Daily Login Rewards — a 7-day escalating streak, separate from the Daily Challenge, claimable once per calendar day from the menu footer.
- **REWORKED**: Meteor Shower victory animation is longer and hits harder — more meteors, ground impact flashes, a deeper secondary boom, and a multi-pulse camera shake.
- **REWORKED**: Void Sleeves now swirl with an animated corner portal and a pulsing void-energy glow instead of a static outline.
- **REWORKED**: Cyber Neon theme gained a periodic full-screen scan beam and a subtle glitch-flicker on cards.
- **REWORKED**: Abyss theme gained a sweeping anglerfish lure light and a stronger jellyfish pulse.
- **REWORKED**: 100% Collector (Diamond Vault) cards throw a little sparkle burst on hover.
- **POLISH**: buttons and cards across the whole app got a tactile ripple/press feel and slightly livelier hover motion.
- Storm theme is untouched, as requested.

## Earlier changes

- **SWAPPED**: Flame and Storm now unlock the opposite way they used to — Flame unlocks by beating Hard, Storm is now the secret 6th theme for beating every difficulty.
- **REDESIGNED**: Storm theme (real supercell — four lightning bolts, full-sky flash, wind streaks, denser rain) and 100% Collector theme (now a "Diamond Vault" — icy white/rose-gold/champagne palette, no longer overlapping visually with Sovereign or its own old look).
- **NEW**: two purchasable Shop themes — Cyber Neon (1200 Bux) and Abyss (1200 Bux).
- **NEW cosmetic category**: Victory Animations. The first is Meteor Shower (500 Bux) — plays a full-screen meteor shower for both players the instant its owner wins, right before the win/lose screen appears.
- **Removed**: Round Timer and Card of the Day (both pulled back out).
- **FIX**: quitting your own multiplayer match no longer flashes "Your opponent forfeited — you win!" at the person who quit.
- **FIX**: pressing Enter in the Join room-code field now submits it, same as tapping Connect.
- **NEW**: Volume slider, Vibration toggle, and a two-step-confirmed Reset All Progress option, all in Options.
- **NEW**: Round Timer (later removed), Deck Builder search & filter, Merge Preview.
- **NEW**: multi-card merges (2-4 cards in one fusion) via 🧬 Combine mode, plus a "mega fusion" celebration for big/Orange merges.
- **BUGFIX**: theme lock icons, Blue regeneration requiring a completed merge first.
- **Removed the hand/draw system.** Every card in a player's deck is visible and available from round 1.
- **Merges require a blueprint in the deck.** No generic "Tier X Fusion" fallback.
- **Fixed a merge-economy bug** that made matches run on forever.
- **Fixed a "cards randomly vanish" report** — delayed queued attacks now surface their own toast.
- **Round cap** lowered from 300 to 60 as a backstop.

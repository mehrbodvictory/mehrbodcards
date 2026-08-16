# Mehrbod Cards

A browser card battler with vs-bot practice (5 difficulty levels) and peer-to-peer multiplayer. Pure static site — no backend, no build step.

## Play it

Open `index.html` directly in a browser, or host the folder anywhere static (e.g. GitHub Pages).

## How to play

- Before each match, build a **deck**: 12 units of any tier you own, 4 spells, and 2 chips. Everything you pick is visible and available from round 1 — there's no hand or draw step.
- Only **Blue** cards can be placed directly. Merging requires a matching-tier blueprint (a Green/Red/Orange card) still sitting unused in your deck — merge two Blues into a Green only if you still have a Green blueprint, two Greens into an Orange only if you still have an Orange blueprint, and so on. The merge consumes that blueprint and uses its name/ability instead of a generic result. Run out of a tier's blueprint and you can never merge into that tier again for the rest of the match — pick some higher-tier cards in the deck builder if you want to fuse up.
- Blue cards regenerate for free on death or merge, but **only** while you still have at least one non-Blue blueprint left in your deck. Once that runs out, Blue stops replenishing for good.
- Each round has a placement phase and an attack phase. Attacks from both players resolve simultaneously once everyone's readied up.
- Defending blocks all damage to that card for the round but forfeits its own attack. Blue defends unlimited times (once unlocked by your first merge), Green once, Red and Orange never.
- You win by reducing the opponent's total cards — deck and board combined — to zero. A 60-round cap guarantees every match ends even in a rare stalemate.
- A first-time player automatically gets a guided tutorial (menu tour + a real practice match) — replay it anytime from "How to play" in the Single Player menu.

## Currency & progression

Everyone starts with 50 **Mehrbod Bux**, and normal spending can never drop below 10. A wager of exactly 10 is allowed when you have exactly 10; losing it leaves you at 10, while winning raises your balance. Earn more by winning wagered matches (Practice vs Bot or Host Match, choosing "Wager Match"). Spend it in the **Mehrbod Shop** on Card Packs (unlock new spells, chips, and unit archetypes) or Cosmetics (the Mr Money theme, card sleeves). The **Collection Book** (📖 Collection from the main menu, or the Collection card on the menu strip) lets you browse every Card you've discovered — including a completion radar at the top — or switch to Themes. **Quests** (🏆) covers theme unlocks, your Daily Challenge, and Forge Milestones all in one panel. **Stats** (📊, menu footer) covers Battle Stats, the Bux Ledger, and Recent Activity in one panel.

## Multiplayer

Host a match to get a 5-character room code; a friend enters it to join. Peer-to-peer via [PeerJS](https://peerjs.com) (loaded from a CDN) — no server of your own required. The host is authoritative over game state; both sides use a shared seeded RNG plus an exchanged deck config to stay perfectly in sync without shipping full game state over the wire.

## Files

```
index.html          Screens & layout
style.css            Styling & themes
js/rng.js            Seeded PRNG shared by both peers
js/cards.js           Card/tier/ability/deck definitions
js/game.js            Rules engine (pure functions over a state object)
js/bot.js             Bot AI, 5 difficulty levels
js/network.js         PeerJS wrapper, host-authoritative sync
js/ui.js               DOM rendering helpers
js/main.js             App controller: screens, input handling, game loop
```

## v3.0 notes (this build)

- **Removed the hand/draw system.** Every card in a player's deck is visible and available from round 1 — placing a Blue or merging into a blueprint just pulls straight from the deck array. This also fixed a related bug where a delayed ("queued") attack from a card that died mid-attack-phase last round could land silently at the very start of the next round, reading to a player as a card randomly vanishing; that now surfaces its own toast.
- **Merges now require a blueprint in the deck.** There's no more generic "Tier X Fusion" fallback — if you don't have a matching-tier Green/Red/Orange card left in your deck, that merge simply isn't legal.
- **Fixed a merge-economy bug that made matches run on forever.** Merging two Blues used to replenish 2 fresh Blues (one per Blue consumed) on top of the 1 merged card produced — a net gain of a card out of thin air on every fusion. It now always replenishes at most 1, matching how a single Blue's death-and-replenish already worked, and replenishment additionally stops once a player has run out of blueprints entirely. The forced-merge rule also gained a safety valve so running dry of blueprints can never lock a player out of their own turn. The round cap was lowered from 300 to a more realistic 60 as a backstop.

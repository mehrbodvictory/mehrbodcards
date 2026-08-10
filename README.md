# Mehrbod Cards

A browser card battler with vs-bot practice (5 difficulty levels) and peer-to-peer multiplayer. Pure static site — no backend, no build step.

## Play it

Open `index.html` directly in a browser, or visit https://mehrbodvictory.github.io/mehrbodcards/

## How to play

- Before each match, build a **deck**: 12 units of any tier you own, 4 spells, and 2 chips.
- Only **Blue** cards can be placed directly. Merge two Blues into a Green, two Greens into an Orange, and so on — that's the only way higher tiers reach the board. A higher-tier card in your deck becomes a "blueprint": it can't be placed, but merging into its exact tier consumes it from hand and uses its name/ability instead of a generic result.
- Each round has a placement phase and an attack phase. Attacks from both players resolve simultaneously once everyone's readied up.
- Defending blocks all damage to that card for the round but forfeits its own attack. Blue defends unlimited times (once unlocked by your first merge), Green once, Red and Orange never.
- You win by reducing the opponent's total cards — deck, hand, and board combined — to zero. A hard 300-round cap guarantees every match ends even in a rare stalemate.
- A first-time player automatically gets a guided tutorial (menu tour + a real practice match) — replay it anytime from "How to play" on the main menu.

## Currency & progression

Everyone starts with 50 **Mehrbod Bux**, and normal spending can never drop below 10. A wager of exactly 10 is allowed when you have exactly 10; losing it leaves you at 10, while winning raises your balance. Earn more by winning wagered matches (Practice vs Bot or Host Match, choosing "Wager Match"). Spend it in the **Mehrbod Shop** on Card Packs (unlock new spells, chips, and unit archetypes) or Cosmetics (the Mr Money theme, card sleeves). The **Collection** screen (from the main menu) shows every card in the game — owned ones normal, uncollected ones greyed out.

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


## Recent update

- First launch asks for a player name before the tutorial.
- The old in-game placement hint was removed; the guided tutorial is the source of gameplay instructions.
- Wager caps are Easy 10, Medium 20, Hard 40, Expert 75, and multiplayer 100.
- Added Prismatic Sleeves, Void Sleeves, and Victory Burst cosmetics.
- Added a dynamic **100% Collector** theme. It is unlocked only when every currently-defined card is collected, so any newly added card automatically locks it again until collected.
- Added best-effort client inventory integrity checks and sanitization. Because this is a static browser game, true cheat-proof currency/inventory authority requires a server.

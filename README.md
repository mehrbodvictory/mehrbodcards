# Mehrbod Cards

A browser card battler with vs-bot practice (5 difficulty levels) and peer-to-peer multiplayer. Pure static site — no backend, no build step.

## Play it

Open `index.html` directly in a browser, or host the folder anywhere static (e.g. GitHub Pages).

## How to play

- Before each match, build a **deck**: 12 units of any tier you own, 4 spells, and 2 chips. Everything you pick is visible and available from round 1 — there's no hand or draw step.
- Only **Blue** cards can be placed directly. Merging requires a matching-tier blueprint (a Green/Red/Orange card) still sitting unused in your deck.
- **Combine mode**: merges are no longer limited to pairs. Tap 🧬 Combine, then tap 2, 3, or 4 of your own cards to select them (or keep using the classic drag-one-card-onto-another gesture for a quick pair merge), then Confirm. Any selection whose tiers sum to 2, 3, or 4 is legal — four Blues can go straight to Orange, three Blues straight to Red, a Blue + Green straight to Orange, and so on — as long as you still have the matching blueprint. The merge consumes that blueprint and uses its name/ability instead of a generic result. Run out of a tier's blueprint and you can never merge into that tier again for the rest of the match — pick some higher-tier cards in the deck builder if you want to fuse up.
- Blue cards regenerate for free on death or merge, but **only** while you still have at least one non-Blue blueprint left in your deck. Once that runs out, Blue stops replenishing for good. (Regeneration on death no longer requires you to have already completed a merge — see Bugfixes below.)
- Each round has a placement phase and an attack phase. Attacks from both players resolve simultaneously once everyone's readied up.
- Defending blocks all damage to that card for the round but forfeits its own attack. Blue defends unlimited times (once unlocked by your first merge), Green once, Red and Orange never.
- You win by reducing the opponent's total cards — deck and board combined — to zero. A 60-round cap guarantees every match ends even in a rare stalemate.
- A first-time player automatically gets a guided tutorial (menu tour + a real practice match) — replay it anytime from "How to play" in the Single Player menu.

## Currency & progression

Everyone starts with 50 **Mehrbod Bux**, and normal spending can never drop below 10. A wager of exactly 10 is allowed when you have exactly 10; losing it leaves you at 10, while winning raises your balance. Earn more by winning wagered matches (Practice vs Bot or Host Match, choosing "Wager Match"). Spend it in the **Mehrbod Shop** on Card Packs (unlock new spells, chips, and unit archetypes) or Cosmetics (the Mr Money theme, card sleeves). The **Collection Book** (📖 Collection from the main menu) lets you browse every Card you've discovered — including a completion radar at the top — or switch to Themes. **Quests** (🏆) covers theme unlocks, your Daily Challenge, and Forge Milestones all in one panel. **Stats** (📊, menu footer) covers Battle Stats, the Bux Ledger, and Recent Activity in one panel.

## Multiplayer

Host a match to get a 5-character room code; a friend enters it to join. Peer-to-peer via [PeerJS](https://peerjs.com) (loaded from a CDN) — no server of your own required. The host is authoritative over game state; both sides use a shared seeded RNG plus an exchanged deck config to stay perfectly in sync without shipping full game state over the wire. Merge actions (single-pair drag or multi-card Combine) are sent as one `{ type:'merge', slots:[...] }` action, so both sides always apply the exact same fusion.

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

## Latest changes (this build)

- **NEW: Round Timer.** Each placement/attack phase now shows a countdown (60s / 40s) in the phase bar; if you don't ready up in time, you're auto-readied so a match can never stall out waiting on one side — important for multiplayer especially. On by default, toggle off anytime in Options.
- **NEW: Deck Builder search & filter.** A search box + tier dropdown now sits above the Units grid in the deck builder, mirroring the Collection Book's tools.
- **NEW: Merge Preview.** While selecting cards in 🧬 Combine mode, a live panel shows the exact HP/DMG/chip-slot stats the resulting card will have and which blueprint(s) it'll pull from, before you confirm the fusion.

## Earlier changes

- **NEW: multi-card merges.** `mergeCards()` in `game.js` now takes a `slots` array of 2-4 board positions instead of a hardcoded pair, and validates that their combined tier lands on 2, 3, or 4 with a blueprint available. The UI gained a new 🧬 Combine mode (tap-to-select up to 4 cards, then Confirm) alongside the existing drag-to-merge gesture, which still works for quick pairs. The bot AI was updated to look for the largest legal fusion available before falling back to a plain pair.
- **JUICE**: 3-4 card fusions and any merge landing on Orange now get a distinct "mega fusion" celebration — an outward ring of sparkle particles, a richer chime, and its own toast — instead of the same small pulse every merge used to get.
- **BUGFIX: theme lock icons.** The 🔒 icon on a theme button in the Themes modal was never actually hidden once that theme got unlocked — only the button's own locked styling was updated, not the icon span sitting on top of it. Fixed with a CSS rule that hides the icon whenever the parent button isn't `.locked`.
- **BUGFIX: Blue regeneration.** Blue cards were only supposed to regenerate on death as long as a non-Blue blueprint is still sitting unused in the deck. In practice they also silently required the player to have *already completed a merge* first (`everMergedUp`), so a fresh player who owned blueprints but hadn't merged yet would watch their Blues die and vanish permanently instead of regenerating, even though a valid blueprint was sitting right there. That extra requirement is removed — Blue now regenerates on death purely based on blueprint availability, matching how merge-based replenishment already worked.

## Earlier notes (v3.0)

- **Removed the hand/draw system.** Every card in a player's deck is visible and available from round 1.
- **Merges require a blueprint in the deck.** No generic "Tier X Fusion" fallback.
- **Fixed a merge-economy bug** that made matches run on forever (Blue+Blue was minting an extra card out of thin air).
- **Fixed a "cards randomly vanish" report** — delayed queued attacks from cards that died mid-attack-phase now surface their own toast instead of resolving silently.
- **Round cap** lowered from 300 to 60 as a backstop.

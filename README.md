# Mehrbod Cards

A browser card battler with vs-bot (5 difficulties) and peer-to-peer multiplayer.
Pure static site — no backend, no build step.

## Host it on GitHub Pages

1. Create a new GitHub repo (or use an existing one).
2. Copy all the files in this folder (`index.html`, `style.css`, `js/`) into the repo root.
3. Commit and push.
4. Repo Settings → Pages → Source: "Deploy from a branch" → branch `main`, folder `/ (root)`.
5. Wait a minute, then visit `https://<your-username>.github.io/<repo-name>/`.

That's it — everything runs client-side. Multiplayer uses [PeerJS](https://peerjs.com)
(loaded from a CDN) for WebRTC signaling, so no server of your own is required.

## How multiplayer works

- The **host** generates a random match seed and a 5-character room code, and
  waits for a peer-to-peer connection.
- The **guest** connects using that code. On connect, the host sends the seed.
- Both sides build the exact same deck/hand/shuffle locally from that seed
  (see `js/rng.js`'s seeded PRNG).
- From then on, only small **action** objects are sent over the wire (place,
  merge, cast spell, attach chip, defend, attack, ready). The **host is
  authoritative**: it applies every action (its own and the guest's) in the
  order it receives them, then echoes the applied action back down to the
  guest, who mirrors it. This guarantees both sides never desync, without
  ever shipping the whole game state.
- If your matches feel like they need a TURN server for stricter NATs, you
  can swap in your own PeerJS server config in `js/network.js` — the public
  PeerJS cloud broker is used by default, which works for most home/mobile
  connections but is not guaranteed for very restrictive networks.
- **Restrictive networks (school/work wifi):** plain STUN often can't punch
  through symmetric NATs or UDP-blocking firewalls, so `js/network.js` also
  configures TURN relay servers (via the free Open Relay Project, including
  TURN-over-TCP on port 443, which passes through firewalls that only allow
  ordinary HTTPS-looking traffic) and a 20-second connection timeout with a
  clear message instead of hanging forever. For a production deployment
  you'd likely want your own TURN server (e.g. via Twilio or Xirsys) rather
  than the free shared one.

## Rule notes / implementation choices

The brief left a few mechanics open to interpretation; here's what was built:

- **Merging**: two cards' tier values must add up to an exact real tier -
  Blue+Blue=Green, Blue+Green=Red, Blue+Red=Orange, Green+Green=Orange. Any
  combination that doesn't land exactly on 2/3/4 (e.g. Green+Red=5) is
  blocked, and Orange can never merge with anything since there's no tier
  above it. Done by dragging one of your board cards and dropping it onto
  another (mouse or touch, via Pointer Events) — no mode button needed.
- **Forced merge**: having 4+ Blue cards on your board at once locks you out
  of every other action — placing, spells, chips, defend, attack, readying
  up — until you resolve it. Your Blue cards glow and a banner explains
  what's needed; you must drag a Blue card onto another Blue (or onto any
  card, as long as one side of the merge is Blue) to clear it. The bot
  resolves this instantly on its own turn since it has no UI to show a
  banner to.
- **Whole deck visible**: every card still in your deck is shown face-up in
  a strip at the bottom of the screen at all times — there's no hidden
  information about what you have left to draw. Only the top 3 (your hand)
  are actually placeable at any moment; the rest are a preview of what's
  coming, including any Blues you've reclaimed mid-match.
- **Extras added along the way**: floating damage/heal/block numbers over
  cards, procedural sound effects (synthesized in-browser via the Web Audio
  API - no audio files to host) with a mute toggle in Options, a persistent
  win/loss record shown on the main menu (localStorage), an 'R' hotkey
  to ready up, and a version number on the main menu you can click for full
  patch notes (`PATCH_NOTES` near the bottom of `js/main.js` — add a new
  entry to the top of that array with each future update).
- **Blue cards are an infinite resource — until they're not.** Whenever a
  Blue card is consumed (fused into something bigger, or killed in combat),
  the player gets a fresh Blue back into their deck, as long as they still
  have at least one non-Blue card somewhere (deck, hand, or board). The
  moment a player is reduced to nothing but Blues, replenishment stops for
  good — no more free Blues from merging or dying after that point. (Note:
  because of this, matches can run long if neither side finishes off the
  opponent's last non-Blue card — that's expected, not a bug.)
- **Defense** is self-only: a card can block all damage aimed at itself
  (becoming invincible that round, but forfeiting its own attack) up to its
  tier's charge limit — Blue unlimited, Green ×1, Red and Orange never. It
  never defends on behalf of another card. Once a player has no non-Blue
  units left anywhere (deck, hand, or board), their Blues can no longer
  defend either.
- **Attack resolution**: both players assign targets simultaneously, then
  damage applies all at once, then deaths and on-death abilities resolve
  immediately. If a card was assigned to attack but got killed by a
  spell/chip before the simultaneous resolution ran, its attack is queued
  and fires at the very start of the next placement round instead (using
  its snapshotted damage).
- **Fail-safe**: if both boards/hands/decks hit zero on the same resolution,
  whoever has more unused spells+chips wins; a further tie is a draw.
- **Board size**: 6 slots per player. **Hand size**: 3 unit cards drawn at a
  time from your 12-card deck. Spells (4, drawn from a pool of 8) and chips
  (2, drawn from a pool of 6) are separate from the 12 and available in full
  from the start of the match.
- **Card catalog** (`js/cards.js`, `UNIT_ARCHETYPES`): each tier has 5 named
  archetypes — the original classic card (Sprite/Warden/Wraith/Colossus),
  which keeps its old randomized ability pool, plus 4 new cards each with
  exactly one guaranteed, unique ability found on no other card, spell, or
  chip in the game. Blue's ability pool is fixed to `none` only — Blue can
  never roll a special ability (this was previously a bug; Blue is meant to
  be the disposable, freely-regenerating tier).
- **Bot difficulty**: Easy, Medium, Hard, Expert, and Master (5 tiers, in
  `js/bot.js`). Master sits above Expert — it fuses cards up more eagerly
  even with board space to spare, heals allies sooner, and defends every
  card that's still capable of it (only Blue and Green now, since Red lost
  the ability to defend).

## Files

```
index.html          Screens & layout
style.css            Theme (dark forge, tier-colored cards)
js/rng.js            Seeded PRNG shared by both peers
js/cards.js           Card/tier/ability/deck definitions
js/game.js            Deterministic rules engine (pure functions over a state object)
js/bot.js             4-difficulty bot AI
js/network.js         PeerJS wrapper, host-authoritative sync
js/ui.js               DOM rendering helpers
js/main.js             App controller: screens, input handling, game loop
```

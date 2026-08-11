// Deterministic seeded RNG (mulberry32) so both peers in a P2P match, and
// bot matches, produce identical shuffles/draws/random ability rolls.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function makeSeed() {
  return Math.floor(Math.random() * 0xffffffff);
}

// Fisher-Yates shuffle using a seeded RNG function (rng() returns [0,1))
function seededShuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A small deterministic RNG stream wrapper. Every consumer of randomness in
// the game (both host & guest, both bot & human matches) pulls from this so
// the exact same seed produces the exact same match trace.
class RngStream {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.fn = mulberry32(this.seed);
    this.calls = 0;
  }
  next() {
    this.calls++;
    return this.fn();
  }
  int(maxExclusive) {
    return Math.floor(this.next() * maxExclusive);
  }
  pick(arr) {
    return arr[this.int(arr.length)];
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

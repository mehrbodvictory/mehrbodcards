// Dynamically loaded background templates for game themes to optimize initial page loading speed and memory footprint
window.THEME_TEMPLATES = {
  flame: `
    <div id="theme-flame-bg" aria-hidden="true">
      <div class="flame-ambient-surge"></div>
      <div class="flame-cavern-haze"></div>
      <div class="flame-bed-back"></div>
      <div class="flame-bed-front"></div>
      <div class="flame-tongue f1"></div>
      <div class="flame-tongue f2"></div>
      <div class="flame-tongue f3"></div>
      <div class="flame-tongue f4"></div>
      <div class="flame-tongue f5"></div>
      <div class="flame-tongue f6"></div>
      <div class="flame-tongue f7"></div>
      <div class="flame-tongue f8"></div>
      <div class="flame-tongue f9"></div>
      <div class="flame-tongue f10"></div>
      <div class="flame-tongue f11"></div>
      <div class="flame-tongue f12"></div>
      <div class="flame-tongue f13"></div>
      <div class="flame-tongue f14"></div>
      <div class="flame-tongue f15"></div>
      <div class="flame-tongue f16"></div>
      <div class="flame-tongue f17"></div>
      <div class="flame-tongue f18"></div>
      <div class="flame-tongue f19"></div>
      <div class="flame-tongue f20"></div>
      <div class="ember e1"></div>
      <div class="ember e2"></div>
      <div class="ember e3"></div>
      <div class="ember e4"></div>
      <div class="ember e5"></div>
      <div class="ember e6"></div>
      <div class="ember e7"></div>
      <div class="ember e8"></div>
      <div class="ember e9"></div>
      <div class="ember e10"></div>
      <div class="ember e11"></div>
      <div class="ember e12"></div>
      <div class="ember e13"></div>
      <div class="ember e14"></div>
      <div class="ember e15"></div>
      <div class="ember e16"></div>
      <div class="ember e17"></div>
      <div class="ember e18"></div>
      <div class="ember e19"></div>
      <div class="ember e20"></div>
      <div class="spark sp1"></div>
      <div class="spark sp2"></div>
      <div class="spark sp3"></div>
      <div class="spark sp4"></div>
      <div class="spark sp5"></div>
      <div class="spark sp6"></div>
      <div class="spark sp7"></div>
      <div class="smoke-wisp sm1"></div>
      <div class="smoke-wisp sm2"></div>
      <div class="smoke-wisp sm3"></div>
      <div class="smoke-wisp sm4"></div>
      <div class="smoke-wisp sm5"></div>
      <div class="smoke-wisp sm6"></div>
      <div class="smoke-wisp sm7"></div>
      <div class="smoke-wisp sm8"></div>
      <div class="smoke-wisp sm9"></div>
      <div class="smoke-wisp sm10"></div>
    </div>
  `,
  sovereign: `
    <div id="theme-sovereign-bg" aria-hidden="true">
      <div class="gold-mote m1"></div>
      <div class="gold-mote m2"></div>
      <div class="gold-mote m3"></div>
      <div class="gold-mote m4"></div>
      <div class="gold-mote m5"></div>
      <div class="gold-mote m6"></div>
    </div>
  `,
  pink: `
    <div id="theme-pink-bg" aria-hidden="true">
      <div class="pink-sparkle p1">✦</div>
      <div class="pink-sparkle p2">✧</div>
      <div class="pink-sparkle p3">✦</div>
      <div class="pink-sparkle p4">✧</div>
      <div class="pink-sparkle p5">✦</div>
    </div>
  `,
  mrmoney: `
    <div id="theme-mrmoney-bg" aria-hidden="true">
      <div class="money-bill mb1">💵</div>
      <div class="money-bill mb2">💰</div>
      <div class="money-bill mb3">💵</div>
      <div class="money-bill mb4">💴</div>
      <div class="money-bill mb5">💵</div>
      <div class="money-bill mb6">💰</div>
      <div class="money-bill mb7">💵</div>
      <div class="money-bill mb8">💴</div>
      <div class="money-bill mb9">💵</div>
      <div class="money-bill mb10">💰</div>
      <div class="money-bill mb11">💵</div>
      <div class="money-bill mb12">💴</div>
      <div class="money-bill mb13">💵</div>
      <div class="money-bill mb14">💰</div>
    </div>
  `,
  storm: `
    <div id="theme-storm-bg" aria-hidden="true">
      <div class="storm-flash"></div>
      <div class="storm-cloud c1"></div>
      <div class="storm-cloud c2"></div>
      <div class="storm-cloud c3"></div>
      <div class="storm-cloud c4"></div>
      <div class="storm-cloud c5"></div>
      <div class="storm-cloud c6"></div>
      <div class="storm-cloud c7"></div>
      <div class="lightning-bolt b1"></div>
      <div class="lightning-bolt b2"></div>
      <div class="lightning-bolt b3"></div>
      <div class="lightning-bolt b4"></div>
      <div class="wind-streak w1"></div>
      <div class="wind-streak w2"></div>
      <div class="wind-streak w3"></div>
      <div class="wind-streak w4"></div>
      <div class="wind-streak w5"></div>
      <div class="wind-streak w6"></div>
      <div class="rain-streak r1"></div>
      <div class="rain-streak r2"></div>
      <div class="rain-streak r3"></div>
      <div class="rain-streak r4"></div>
      <div class="rain-streak r5"></div>
      <div class="rain-streak r6"></div>
      <div class="rain-streak r7"></div>
      <div class="rain-streak r8"></div>
      <div class="rain-streak r9"></div>
      <div class="rain-streak r10"></div>
      <div class="rain-streak r11"></div>
      <div class="rain-streak r12"></div>
      <div class="rain-streak r13"></div>
      <div class="rain-streak r14"></div>
      <div class="rain-streak r15"></div>
      <div class="rain-streak r16"></div>
      <div class="rain-streak r17"></div>
      <div class="rain-streak r18"></div>
      <div class="rain-streak r19"></div>
      <div class="rain-streak r20"></div>
    </div>
  `,
  cyberneon: `
    <div id="theme-cyberneon-bg" aria-hidden="true">
      <div class="cyber-perspective-grid"></div>
      <div class="cyber-horizon-glow"></div>
      <div class="neon-particle np1">01</div>
      <div class="neon-particle np2">▲</div>
      <div class="neon-particle np3">10</div>
      <div class="neon-particle np4">◆</div>
      <div class="neon-particle np5">11</div>
      <div class="neon-particle np6">▲</div>
      <div class="neon-particle np7">00</div>
      <div class="neon-particle np8">◆</div>
    </div>
  `,
  abyss: `
    <div id="theme-abyss-bg" aria-hidden="true">
      <div class="abyss-jelly j1"></div>
      <div class="abyss-jelly j2"></div>
      <div class="abyss-jelly j3"></div>
      <div class="abyss-bubble bb1"></div>
      <div class="abyss-bubble bb2"></div>
      <div class="abyss-bubble bb3"></div>
      <div class="abyss-bubble bb4"></div>
      <div class="abyss-bubble bb5"></div>
      <div class="abyss-bubble bb6"></div>
      <div class="abyss-bubble bb7"></div>
      <div class="abyss-bubble bb8"></div>
      <div class="abyss-bubble bb9"></div>
      <div class="abyss-bubble bb10"></div>
    </div>
  `,
  magma: `
    <div id="theme-magma-bg" aria-hidden="true">
      <div class="magma-heat-surge"></div>
      <div class="magma-cavern-glow"></div>
      <div class="magma-smoke-layer"></div>
      <div class="magma-rock-crags left"></div>
      <div class="magma-rock-crags right"></div>
      <div class="magma-fissure f1"></div>
      <div class="magma-fissure f2"></div>
      <div class="magma-fissure f3"></div>
      <div class="magma-sea-back"></div>
      <div class="magma-sea-front"></div>
      <div class="magma-bubble mb1"></div>
      <div class="magma-bubble mb2"></div>
      <div class="magma-bubble mb3"></div>
      <div class="magma-bubble mb4"></div>
      <div class="magma-bubble mb5"></div>
      <div class="magma-ember e1"></div>
      <div class="magma-ember e2"></div>
      <div class="magma-ember e3"></div>
      <div class="magma-ember e4"></div>
      <div class="magma-ember e5"></div>
      <div class="magma-ember e6"></div>
      <div class="magma-ember e7"></div>
      <div class="magma-ember e8"></div>
      <div class="magma-ember e9"></div>
      <div class="magma-ember e10"></div>
      <div class="magma-ember e11"></div>
      <div class="magma-ember e12"></div>
      <div class="magma-ember e13"></div>
      <div class="magma-ember e14"></div>
    </div>
  `,
  aurora: `
    <div id="theme-aurora-bg" aria-hidden="true">
      <div class="galaxy-core"></div>
      <div class="solar-system">
        <div class="sun"></div>
        <div class="orbit o1"><div class="planet planet-mercury"></div></div>
        <div class="orbit o2"><div class="planet planet-venus"></div></div>
        <div class="orbit o3"><div class="planet planet-earth"></div></div>
        <div class="orbit o4"><div class="planet planet-mars"></div></div>
        <div class="orbit o5"><div class="planet planet-jupiter"></div></div>
        <div class="orbit o6"><div class="planet planet-saturn"></div></div>
        <div class="orbit o7"><div class="planet planet-uranus"></div></div>
        <div class="orbit o8"><div class="planet planet-neptune"></div></div>
      </div>
      <div class="aurora-ribbon a1"></div>
      <div class="aurora-ribbon a2"></div>
      <div class="aurora-ribbon a3"></div>
      <div class="aurora-ribbon a4"></div>
      <div class="aurora-ribbon a5"></div>
      <div class="aurora-star s1"></div>
      <div class="aurora-star s2"></div>
      <div class="aurora-star s3"></div>
      <div class="aurora-star s4"></div>
      <div class="aurora-star s5"></div>
      <div class="aurora-star s6"></div>
      <div class="aurora-star s7"></div>
      <div class="aurora-star s8"></div>
      <div class="aurora-star s9"></div>
      <div class="aurora-star s10"></div>
      <div class="aurora-star s11"></div>
      <div class="aurora-star s12"></div>
      <div class="shooting-star ss1"></div>
      <div class="shooting-star ss2"></div>
    </div>
  `,
  quantum: `
    <div id="theme-quantum-bg" aria-hidden="true">
      <div class="quantum-space-mesh"></div>
      <div class="quantum-core-pulse"></div>
      <div class="quantum-time-ribbon r1"></div>
      <div class="quantum-time-ribbon r2"></div>
      <div class="quantum-tachyon-ring tr1"></div>
      <div class="quantum-tachyon-ring tr2"></div>
      <div class="quantum-tachyon-ring tr3"></div>
      <div class="quantum-node qn1"></div>
      <div class="quantum-node qn2"></div>
      <div class="quantum-node qn3"></div>
      <div class="quantum-node qn4"></div>
      <div class="quantum-node qn5"></div>
      <div class="quantum-node qn6"></div>
      <div class="quantum-node qn7"></div>
      <div class="quantum-node qn8"></div>
      <div class="quantum-stream s1"></div>
      <div class="quantum-stream s2"></div>
      <div class="quantum-stream s3"></div>
      <div class="quantum-stream s4"></div>
      <div class="quantum-stream s5"></div>
      <div class="quantum-stream s6"></div>
    </div>
  `,
  glacier: `
    <div id="theme-glacier-bg" aria-hidden="true">
      <div class="glacier-subzero-haze"></div>
      <div class="glacier-aurora-wave gw1"></div>
      <div class="glacier-aurora-wave gw2"></div>
      <div class="glacier-aurora-wave gw3"></div>
      <div class="glacier-crystal-spires left"></div>
      <div class="glacier-crystal-spires right"></div>
      <div class="glacier-ice-prism ip1"></div>
      <div class="glacier-ice-prism ip2"></div>
      <div class="glacier-ice-prism ip3"></div>
      <div class="glacier-cryo-flake f1"></div>
      <div class="glacier-cryo-flake f2"></div>
      <div class="glacier-cryo-flake f3"></div>
      <div class="glacier-cryo-flake f4"></div>
      <div class="glacier-cryo-flake f5"></div>
      <div class="glacier-cryo-flake f6"></div>
      <div class="glacier-cryo-flake f7"></div>
      <div class="glacier-cryo-flake f8"></div>
      <div class="glacier-cryo-flake f9"></div>
      <div class="glacier-cryo-flake f10"></div>
      <div class="glacier-cryo-flake f11"></div>
      <div class="glacier-cryo-flake f12"></div>
    </div>
  `,
  celestial: `
    <div id="theme-celestial-bg" aria-hidden="true">
      <div class="celestial-heavens-glow"></div>
      <div class="celestial-god-ray ray1"></div>
      <div class="celestial-god-ray ray2"></div>
      <div class="celestial-god-ray ray3"></div>
      <div class="celestial-god-ray ray4"></div>
      <div class="celestial-mandala-outer"></div>
      <div class="celestial-mandala-mid"></div>
      <div class="celestial-mandala-inner"></div>
      <div class="celestial-divine-orb"></div>
      <div class="celestial-halo-ring hr1"></div>
      <div class="celestial-halo-ring hr2"></div>
      <div class="celestial-stardust st1"></div>
      <div class="celestial-stardust st2"></div>
      <div class="celestial-stardust st3"></div>
      <div class="celestial-stardust st4"></div>
      <div class="celestial-stardust st5"></div>
      <div class="celestial-stardust st6"></div>
      <div class="celestial-stardust st7"></div>
      <div class="celestial-stardust st8"></div>
      <div class="celestial-stardust st9"></div>
      <div class="celestial-stardust st10"></div>
      <div class="celestial-stardust st11"></div>
      <div class="celestial-stardust st12"></div>
    </div>
  `,
  astral: `
    <div id="theme-astral-bg" aria-hidden="true">
      <div class="astral-space-warp"></div>
      <div class="astral-nebula-field">
        <div class="astral-nebula n-violet"></div>
        <div class="astral-nebula n-cyan"></div>
        <div class="astral-nebula n-rose"></div>
        <div class="astral-nebula n-gold"></div>
        <div class="astral-nebula n-deep"></div>
      </div>
      <div class="astral-singularity-rig">
        <div class="astral-grav-lens"></div>
        <div class="astral-accretion-outer"></div>
        <div class="astral-accretion-core"></div>
        <div class="astral-photon-sphere"></div>
        <div class="astral-singularity-void"></div>
        <div class="astral-jet-beam top"></div>
        <div class="astral-jet-beam btm"></div>
        <div class="astral-pulsar-burst"></div>
        <div class="astral-halo-ring r1"></div>
        <div class="astral-halo-ring r2"></div>
        <div class="astral-halo-ring r3"></div>
      </div>
      <div class="astral-constellations">
        <div class="astral-const-line cl1"></div>
        <div class="astral-const-line cl2"></div>
        <div class="astral-const-line cl3"></div>
      </div>
      <div class="astral-star-field">
        <div class="astral-star as1"></div>
        <div class="astral-star as2"></div>
        <div class="astral-star as3"></div>
        <div class="astral-star as4"></div>
        <div class="astral-star as5"></div>
        <div class="astral-star as6"></div>
        <div class="astral-star as7"></div>
        <div class="astral-star as8"></div>
        <div class="astral-star as9"></div>
        <div class="astral-star as10"></div>
        <div class="astral-star as11"></div>
        <div class="astral-star as12"></div>
        <div class="astral-star as13"></div>
        <div class="astral-star as14"></div>
        <div class="astral-star as15"></div>
        <div class="astral-star as16"></div>
        <div class="astral-star as17"></div>
        <div class="astral-star as18"></div>
        <div class="astral-star as19"></div>
        <div class="astral-star as20"></div>
      </div>
      <div class="astral-motes">
        <div class="astral-mote m1"></div>
        <div class="astral-mote m2"></div>
        <div class="astral-mote m3"></div>
        <div class="astral-mote m4"></div>
        <div class="astral-mote m5"></div>
        <div class="astral-mote m6"></div>
      </div>
      <div class="astral-comets">
        <div class="astral-comet ac1"></div>
        <div class="astral-comet ac2"></div>
        <div class="astral-comet ac3"></div>
        <div class="astral-comet ac4"></div>
      </div>
    </div>
  `,
  verdant: `
    <div id="theme-verdant-bg" aria-hidden="true">
      <div class="verdant-canopy-glow"></div>
      <div class="verdant-spore vs1"></div>
      <div class="verdant-spore vs2"></div>
      <div class="verdant-spore vs3"></div>
      <div class="verdant-spore vs4"></div>
      <div class="verdant-spore vs5"></div>
      <div class="verdant-leaf-shape vl1"></div>
      <div class="verdant-leaf-shape vl2"></div>
      <div class="verdant-leaf-shape vl3"></div>
    </div>
  `,
  prism: `
    <div id="theme-prism-bg" aria-hidden="true">
      <div class="prism-obsidian-bedrock"></div>
      <div class="prism-refraction-caustic-primary"></div>
      <div class="prism-refraction-caustic-secondary"></div>
      <div class="prism-chromatic-ring"></div>
      <div class="prism-core-pulse"></div>
      <div class="prism-crystal-octahedron">
        <div class="octa-face f1"></div>
        <div class="octa-face f2"></div>
        <div class="octa-face f3"></div>
        <div class="octa-face f4"></div>
      </div>
      <div class="prism-laser-pillar p1"></div>
      <div class="prism-laser-pillar p2"></div>
      <div class="prism-cosmic-dust cd1"></div>
      <div class="prism-cosmic-dust cd2"></div>
      <div class="prism-cosmic-dust cd3"></div>
      <div class="prism-cosmic-dust cd4"></div>
      <div class="prism-cosmic-dust cd5"></div>
      <div class="prism-cosmic-dust cd6"></div>
      <div class="prism-cosmic-dust cd7"></div>
      <div class="prism-cosmic-dust cd8"></div>
      <div class="prism-cosmic-dust cd9"></div>
      <div class="prism-cosmic-dust cd10"></div>
      <div class="prism-cosmic-dust cd11"></div>
      <div class="prism-cosmic-dust cd12"></div>
      <div class="prism-dispersion-ray ray1"></div>
      <div class="prism-dispersion-ray ray2"></div>
      <div class="prism-dispersion-ray ray3"></div>
      <div class="prism-light-beam b1"></div>
      <div class="prism-light-beam b2"></div>
      <div class="prism-crystal-lattice"></div>
      <div class="prism-light-sweep"></div>
      <div class="prism-diamond-shard ds1"></div>
      <div class="prism-diamond-shard ds2"></div>
      <div class="prism-diamond-shard ds3"></div>
      <div class="prism-diamond-shard ds4"></div>
      <div class="prism-diamond-shard ds5"></div>
      <div class="prism-diamond-shard ds6"></div>
      <div class="prism-diamond-shard ds7"></div>
      <div class="prism-diamond-shard ds8"></div>
      <div class="prism-refractor-sparkle ps1"></div>
      <div class="prism-refractor-sparkle ps2"></div>
      <div class="prism-refractor-sparkle ps3"></div>
      <div class="prism-refractor-sparkle ps4"></div>
      <div class="prism-refractor-sparkle ps5"></div>
      <div class="prism-refractor-sparkle ps6"></div>
      <div class="prism-refractor-sparkle ps7"></div>
      <div class="prism-refractor-sparkle ps8"></div>
      <div class="prism-refractor-sparkle ps9"></div>
      <div class="prism-refractor-sparkle ps10"></div>
      <div class="prism-refractor-sparkle ps11"></div>
      <div class="prism-refractor-sparkle ps12"></div>
      <div class="prism-refractor-sparkle ps13"></div>
      <div class="prism-refractor-sparkle ps14"></div>
      <div class="prism-refractor-sparkle ps15"></div>
      <div class="prism-refractor-sparkle ps16"></div>
    </div>
  `,
  darkmatter: `
    <div id="theme-prism-bg" aria-hidden="true">
      <div class="prism-obsidian-bedrock"></div>
      <div class="prism-refraction-caustic-primary"></div>
      <div class="prism-refraction-caustic-secondary"></div>
      <div class="prism-dispersion-ray ray1"></div>
      <div class="prism-dispersion-ray ray2"></div>
      <div class="prism-dispersion-ray ray3"></div>
      <div class="prism-crystal-lattice"></div>
      <div class="prism-light-sweep"></div>
      <div class="prism-diamond-shard ds1"></div>
      <div class="prism-diamond-shard ds2"></div>
      <div class="prism-diamond-shard ds3"></div>
      <div class="prism-diamond-shard ds4"></div>
      <div class="prism-diamond-shard ds5"></div>
      <div class="prism-diamond-shard ds6"></div>
      <div class="prism-diamond-shard ds7"></div>
      <div class="prism-diamond-shard ds8"></div>
      <div class="prism-refractor-sparkle ps1"></div>
      <div class="prism-refractor-sparkle ps2"></div>
      <div class="prism-refractor-sparkle ps3"></div>
      <div class="prism-refractor-sparkle ps4"></div>
      <div class="prism-refractor-sparkle ps5"></div>
      <div class="prism-refractor-sparkle ps6"></div>
      <div class="prism-refractor-sparkle ps7"></div>
      <div class="prism-refractor-sparkle ps8"></div>
      <div class="prism-refractor-sparkle ps9"></div>
      <div class="prism-refractor-sparkle ps10"></div>
      <div class="prism-refractor-sparkle ps11"></div>
      <div class="prism-refractor-sparkle ps12"></div>
    </div>
  `,
  valentine: `
    <div id="theme-valentine-bg" aria-hidden="true">
      <div class="valentine-rose-haze"></div>
      <div class="valentine-heart-shape vh1"></div>
      <div class="valentine-heart-shape vh2"></div>
      <div class="valentine-heart-shape vh3"></div>
      <div class="valentine-petal-shape vp1"></div>
      <div class="valentine-petal-shape vp2"></div>
      <div class="valentine-petal-shape vp3"></div>
    </div>
  `,
  sakura: `
    <div id="theme-sakura-bg" aria-hidden="true">
      <div class="sakura-soft-glow"></div>
      <div class="sakura-petal-vector sp1"></div>
      <div class="sakura-petal-vector sp2"></div>
      <div class="sakura-petal-vector sp3"></div>
      <div class="sakura-petal-vector sp4"></div>
      <div class="sakura-petal-vector sp5"></div>
      <div class="sakura-petal-vector sp6"></div>
    </div>
  `,
  solar: `
    <div id="theme-solar-bg" aria-hidden="true">
      <div class="solar-corona-core"></div>
      <div class="solar-flare-ray sfr1"></div>
      <div class="solar-flare-ray sfr2"></div>
      <div class="solar-flare-ray sfr3"></div>
      <div class="solar-prominence-arc pa1"></div>
      <div class="solar-prominence-arc pa2"></div>
    </div>
  `,
  steampunk: `
    <div id="theme-steampunk-bg" aria-hidden="true">
      <div class="steampunk-brass-haze"></div>
      <div class="steampunk-gear-ring gr1"></div>
      <div class="steampunk-gear-ring gr2"></div>
      <div class="steampunk-gear-ring gr3"></div>
      <div class="steampunk-steam-cloud sc1"></div>
      <div class="steampunk-steam-cloud sc2"></div>
    </div>
  `,
  galaxy: `
    <div id="theme-galaxy-bg" aria-hidden="true">
      <div class="galaxy-spiral-arm"></div>
      <div class="galaxy-dust-cloud gd1"></div>
      <div class="galaxy-dust-cloud gd2"></div>
      <div class="galaxy-star-particle gs1"></div>
      <div class="galaxy-star-particle gs2"></div>
      <div class="galaxy-star-particle gs3"></div>
      <div class="galaxy-star-particle gs4"></div>
    </div>
  `,

  // ============================================================
  // SEASON 1 BATTLE PASS 3D / 2.5D THEME TEMPLATES
  // ============================================================

  // 1. Chronos Horizon (⏳ Tier 1) - 3D Clockwork Astrolabe & Temporal Orrery World
  chronos: `
    <div id="theme-chronos-bg" class="theme-3d-scene chronos-3d-astrolabe" aria-hidden="true">
      <div class="chronos-deep-void"></div>
      <div class="chronos-temporal-grid"></div>
      <div class="chronos-celestial-rings-back">
        <div class="chronos-cosmic-ring r-back-1"></div>
        <div class="chronos-cosmic-ring r-back-2"></div>
        <div class="chronos-cosmic-ring r-back-3"></div>
      </div>
      <div class="chronos-3d-stage">
        <div class="chronos-orrery-ring r1">
          <div class="chronos-planet-mote pm1"></div>
          <div class="chronos-planet-mote pm2"></div>
        </div>
        <div class="chronos-orrery-ring r2">
          <div class="chronos-planet-mote pm3"></div>
        </div>
        <div class="chronos-orrery-ring r3"></div>
        <div class="chronos-gear-clockwork cg1">
          <div class="gear-tooth"></div><div class="gear-tooth"></div><div class="gear-tooth"></div><div class="gear-tooth"></div>
        </div>
        <div class="chronos-gear-clockwork cg2"></div>
        <div class="chronos-gear-clockwork cg3"></div>
        <div class="chronos-gear-clockwork cg4"></div>
        <div class="chronos-dial-center">
          <div class="chronos-clock-face">
          </div>
          <div class="chronos-clock-hand hand-h"></div>
          <div class="chronos-clock-hand hand-m"></div>
          <div class="chronos-clock-hand hand-s"></div>
          <div class="chronos-clock-pin">
            <div class="chronos-wormhole-core"></div>
          </div>
        </div>
        <div class="chronos-3d-pendulum">
          <div class="chronos-pendulum-arm"></div>
          <div class="chronos-pendulum-bob"></div>
        </div>
      </div>
      <div class="chronos-temporal-haze"></div>
      <div class="chronos-stardust cs1"></div>
      <div class="chronos-stardust cs2"></div>
      <div class="chronos-stardust cs3"></div>
      <div class="chronos-stardust cs4"></div>
      <div class="chronos-stardust cs5"></div>
      <div class="chronos-stardust cs6"></div>
      <div class="chronos-stardust cs7"></div>
      <div class="chronos-stardust cs8"></div>
      <div class="chronos-light-sweep"></div>
      <div class="chronos-hourglass-stream">
        <span class="sand-grain s1"></span><span class="sand-grain s2"></span><span class="sand-grain s3"></span><span class="sand-grain s4"></span>
        <span class="sand-grain s5"></span><span class="sand-grain s6"></span><span class="sand-grain s7"></span><span class="sand-grain s8"></span>
      </div>
    </div>
  `,
  theme_chronos: `
    <div id="theme-chronos-bg" class="theme-3d-scene chronos-3d-astrolabe" aria-hidden="true">
      <div class="chronos-deep-void"></div>
      <div class="chronos-temporal-grid"></div>
      <div class="chronos-celestial-rings-back">
        <div class="chronos-cosmic-ring r-back-1"></div>
        <div class="chronos-cosmic-ring r-back-2"></div>
        <div class="chronos-cosmic-ring r-back-3"></div>
      </div>
      <div class="chronos-3d-stage">
        <div class="chronos-orrery-ring r1">
          <div class="chronos-planet-mote pm1"></div>
          <div class="chronos-planet-mote pm2"></div>
        </div>
        <div class="chronos-orrery-ring r2">
          <div class="chronos-planet-mote pm3"></div>
        </div>
        <div class="chronos-orrery-ring r3"></div>
        <div class="chronos-gear-clockwork cg1">
          <div class="gear-tooth"></div><div class="gear-tooth"></div><div class="gear-tooth"></div><div class="gear-tooth"></div>
        </div>
        <div class="chronos-gear-clockwork cg2"></div>
        <div class="chronos-gear-clockwork cg3"></div>
        <div class="chronos-gear-clockwork cg4"></div>
        <div class="chronos-dial-center">
          <div class="chronos-clock-face">
          </div>
          <div class="chronos-clock-hand hand-h"></div>
          <div class="chronos-clock-hand hand-m"></div>
          <div class="chronos-clock-hand hand-s"></div>
          <div class="chronos-clock-pin">
            <div class="chronos-wormhole-core"></div>
          </div>
        </div>
        <div class="chronos-3d-pendulum">
          <div class="chronos-pendulum-arm"></div>
          <div class="chronos-pendulum-bob"></div>
        </div>
      </div>
      <div class="chronos-temporal-haze"></div>
      <div class="chronos-stardust cs1"></div>
      <div class="chronos-stardust cs2"></div>
      <div class="chronos-stardust cs3"></div>
      <div class="chronos-stardust cs4"></div>
      <div class="chronos-stardust cs5"></div>
      <div class="chronos-stardust cs6"></div>
      <div class="chronos-stardust cs7"></div>
      <div class="chronos-stardust cs8"></div>
      <div class="chronos-light-sweep"></div>
      <div class="chronos-hourglass-stream">
        <span class="sand-grain s1"></span><span class="sand-grain s2"></span><span class="sand-grain s3"></span><span class="sand-grain s4"></span>
        <span class="sand-grain s5"></span><span class="sand-grain s6"></span><span class="sand-grain s7"></span><span class="sand-grain s8"></span>
      </div>
    </div>
  `,

  // 2. Hyperdrive Cyber-Grid (🌆 Tier 10) - 3D Outrun Synthwave Cyber Metropolis
  neon_cyberpunk: `
    <div id="theme-neon_cyberpunk-bg" class="theme-3d-scene cyberpunk-3d-stage" aria-hidden="true">
      <div class="hyperdrive-skyline-haze"></div>
      <div class="hyperdrive-cyber-cityscape">
        <div class="cyber-building cb1"><div class="cb-windows"></div></div>
        <div class="cyber-building cb2"><div class="cb-windows"></div><div class="cb-antenna"></div></div>
        <div class="cyber-building cb3"><div class="cb-windows"></div></div>
        <div class="cyber-building cb4"><div class="cb-windows"></div><div class="cb-beacon"></div></div>
        <div class="cyber-building cb5"><div class="cb-windows"></div></div>
      </div>
      <div class="hyperdrive-grid-floor"></div>
      <div class="hyperdrive-vapor-sun">
        <div class="vapor-sun-lines"></div>
        <div class="vapor-sun-corona"></div>
      </div>
      <div class="hyperdrive-horizon-glow"></div>
      <div class="hyperdrive-laser-road">
        <div class="road-tracer left"></div>
        <div class="road-tracer right"></div>
        <div class="road-tracer center"></div>
      </div>
      <div class="hyperdrive-speed-line sl1"></div>
      <div class="hyperdrive-speed-line sl2"></div>
      <div class="hyperdrive-speed-line sl3"></div>
      <div class="hyperdrive-speed-line sl4"></div>
      <div class="hyperdrive-speed-line sl5"></div>
      <div class="hyperdrive-speed-line sl6"></div>
      <div class="hyperdrive-holo-pyramid p1"></div>
      <div class="hyperdrive-holo-pyramid p2"></div>
      <div class="hyperdrive-holo-pyramid p3"></div>
      <div class="hyperdrive-laser-beam lb1"></div>
      <div class="hyperdrive-laser-beam lb2"></div>
      <div class="hyperdrive-cyber-rain cr1"></div>
      <div class="hyperdrive-cyber-rain cr2"></div>
      <div class="hyperdrive-cyber-rain cr3"></div>
    </div>
  `,
  theme_neon_cyberpunk: `
    <div id="theme-neon_cyberpunk-bg" class="theme-3d-scene cyberpunk-3d-stage" aria-hidden="true">
      <div class="hyperdrive-skyline-haze"></div>
      <div class="hyperdrive-cyber-cityscape">
        <div class="cyber-building cb1"><div class="cb-windows"></div></div>
        <div class="cyber-building cb2"><div class="cb-windows"></div><div class="cb-antenna"></div></div>
        <div class="cyber-building cb3"><div class="cb-windows"></div></div>
        <div class="cyber-building cb4"><div class="cb-windows"></div><div class="cb-beacon"></div></div>
        <div class="cyber-building cb5"><div class="cb-windows"></div></div>
      </div>
      <div class="hyperdrive-grid-floor"></div>
      <div class="hyperdrive-vapor-sun">
        <div class="vapor-sun-lines"></div>
        <div class="vapor-sun-corona"></div>
      </div>
      <div class="hyperdrive-horizon-glow"></div>
      <div class="hyperdrive-laser-road">
        <div class="road-tracer left"></div>
        <div class="road-tracer right"></div>
        <div class="road-tracer center"></div>
      </div>
      <div class="hyperdrive-speed-line sl1"></div>
      <div class="hyperdrive-speed-line sl2"></div>
      <div class="hyperdrive-speed-line sl3"></div>
      <div class="hyperdrive-speed-line sl4"></div>
      <div class="hyperdrive-speed-line sl5"></div>
      <div class="hyperdrive-speed-line sl6"></div>
      <div class="hyperdrive-holo-pyramid p1"></div>
      <div class="hyperdrive-holo-pyramid p2"></div>
      <div class="hyperdrive-holo-pyramid p3"></div>
      <div class="hyperdrive-laser-beam lb1"></div>
      <div class="hyperdrive-laser-beam lb2"></div>
      <div class="hyperdrive-cyber-rain cr1"></div>
      <div class="hyperdrive-cyber-rain cr2"></div>
      <div class="hyperdrive-cyber-rain cr3"></div>
    </div>
  `,

  // 3. Void Singularity (🌌 Tier 20) - 3D Relativistic Black Hole & Accretion Vortex
  void_singularity: `
    <div id="theme-void_singularity-bg" class="theme-3d-scene singularity-3d-stage" aria-hidden="true">
      <div class="singularity-deep-cosmos"></div>
      <div class="singularity-gravitational-field"></div>
      <div class="singularity-3d-vortex">
        <div class="singularity-accretion-outer-halo"></div>
        <div class="singularity-accretion-disk ad1"></div>
        <div class="singularity-accretion-disk ad2"></div>
        <div class="singularity-photon-ring"></div>
        <div class="singularity-event-horizon"></div>
        <div class="singularity-hawking-jet jet-north"></div>
        <div class="singularity-hawking-jet jet-south"></div>
        <div class="singularity-jet-spiral jsp1"></div>
        <div class="singularity-jet-spiral jsp2"></div>
      </div>
      <div class="singularity-warp-wave ww1"></div>
      <div class="singularity-warp-wave ww2"></div>
      <div class="singularity-warp-wave ww3"></div>
      <div class="singularity-void-mote vm1"></div>
      <div class="singularity-void-mote vm2"></div>
      <div class="singularity-void-mote vm3"></div>
      <div class="singularity-void-mote vm4"></div>
      <div class="singularity-void-mote vm5"></div>
      <div class="singularity-void-mote vm6"></div>
      <div class="singularity-void-mote vm7"></div>
      <div class="singularity-void-mote vm8"></div>
    </div>
  `,
  theme_void_singularity: `
    <div id="theme-void_singularity-bg" class="theme-3d-scene singularity-3d-stage" aria-hidden="true">
      <div class="singularity-deep-cosmos"></div>
      <div class="singularity-gravitational-field"></div>
      <div class="singularity-3d-vortex">
        <div class="singularity-accretion-outer-halo"></div>
        <div class="singularity-accretion-disk ad1"></div>
        <div class="singularity-accretion-disk ad2"></div>
        <div class="singularity-photon-ring"></div>
        <div class="singularity-event-horizon"></div>
        <div class="singularity-hawking-jet jet-north"></div>
        <div class="singularity-hawking-jet jet-south"></div>
        <div class="singularity-jet-spiral jsp1"></div>
        <div class="singularity-jet-spiral jsp2"></div>
      </div>
      <div class="singularity-warp-wave ww1"></div>
      <div class="singularity-warp-wave ww2"></div>
      <div class="singularity-warp-wave ww3"></div>
      <div class="singularity-void-mote vm1"></div>
      <div class="singularity-void-mote vm2"></div>
      <div class="singularity-void-mote vm3"></div>
      <div class="singularity-void-mote vm4"></div>
      <div class="singularity-void-mote vm5"></div>
      <div class="singularity-void-mote vm6"></div>
      <div class="singularity-void-mote vm7"></div>
      <div class="singularity-void-mote vm8"></div>
    </div>
  `,

  // 4. Quantum Horizon (⚛️ Tier 25) - 3D Subatomic Matrix & Superposition Chamber
  quantum_overdrive: `
    <div id="theme-quantum_overdrive-bg" class="theme-3d-scene quantum-3d-stage" aria-hidden="true">
      <div class="quantum-subatomic-void"></div>
      <div class="quantum-matrix-plane"></div>
      <div class="quantum-lattice-sphere"></div>
      <div class="quantum-3d-atom">
        <div class="quantum-nucleus-core">
          <div class="quantum-proton-spark p1"></div>
          <div class="quantum-proton-spark p2"></div>
          <div class="quantum-proton-spark p3"></div>
        </div>
        <div class="quantum-orbital ring-x">
          <div class="quantum-electron e1"></div>
          <div class="quantum-orbital-glow"></div>
        </div>
        <div class="quantum-orbital ring-y">
          <div class="quantum-electron e2"></div>
          <div class="quantum-orbital-glow"></div>
        </div>
        <div class="quantum-orbital ring-z">
          <div class="quantum-electron e3"></div>
          <div class="quantum-orbital-glow"></div>
        </div>
        <div class="quantum-orbital ring-w">
          <div class="quantum-electron e4"></div>
        </div>
      </div>
      <div class="quantum-wave-packet wp1"></div>
      <div class="quantum-wave-packet wp2"></div>
      <div class="quantum-wave-packet wp3"></div>
      <div class="quantum-interference-grid"></div>
      <div class="quantum-quark-spark qs1"></div>
      <div class="quantum-quark-spark qs2"></div>
      <div class="quantum-quark-spark qs3"></div>
      <div class="quantum-quark-spark qs4"></div>
      <div class="quantum-quark-spark qs5"></div>
      <div class="quantum-quark-spark qs6"></div>
    </div>
  `,
  theme_quantum_overdrive: `
    <div id="theme-quantum_overdrive-bg" class="theme-3d-scene quantum-3d-stage" aria-hidden="true">
      <div class="quantum-subatomic-void"></div>
      <div class="quantum-matrix-plane"></div>
      <div class="quantum-lattice-sphere"></div>
      <div class="quantum-3d-atom">
        <div class="quantum-nucleus-core">
          <div class="quantum-proton-spark p1"></div>
          <div class="quantum-proton-spark p2"></div>
          <div class="quantum-proton-spark p3"></div>
        </div>
        <div class="quantum-orbital ring-x">
          <div class="quantum-electron e1"></div>
          <div class="quantum-orbital-glow"></div>
        </div>
        <div class="quantum-orbital ring-y">
          <div class="quantum-electron e2"></div>
          <div class="quantum-orbital-glow"></div>
        </div>
        <div class="quantum-orbital ring-z">
          <div class="quantum-electron e3"></div>
          <div class="quantum-orbital-glow"></div>
        </div>
        <div class="quantum-orbital ring-w">
          <div class="quantum-electron e4"></div>
        </div>
      </div>
      <div class="quantum-wave-packet wp1"></div>
      <div class="quantum-wave-packet wp2"></div>
      <div class="quantum-wave-packet wp3"></div>
      <div class="quantum-interference-grid"></div>
      <div class="quantum-quark-spark qs1"></div>
      <div class="quantum-quark-spark qs2"></div>
      <div class="quantum-quark-spark qs3"></div>
      <div class="quantum-quark-spark qs4"></div>
      <div class="quantum-quark-spark qs5"></div>
      <div class="quantum-quark-spark qs6"></div>
    </div>
  `,

  // 5. Solar Corona (☀️ Tier 35) - 3D Stellar Photosphere & Magnetic Flare Arcs
  solar_prominence: `
    <div id="theme-solar_prominence-bg" class="theme-3d-scene solar-3d-stage" aria-hidden="true">
      <div class="solar-photosphere-glow"></div>
      <div class="solar-granulation-surface"></div>
      <div class="solar-heliosphere-ring"></div>
      <div class="solar-3d-sun">
        <div class="solar-core-sphere">
          <div class="solar-sunspot sp1"></div>
          <div class="solar-sunspot sp2"></div>
          <div class="solar-sunspot sp3"></div>
        </div>
        <div class="solar-prominence-arc arc1"></div>
        <div class="solar-prominence-arc arc2"></div>
        <div class="solar-prominence-arc arc3"></div>
        <div class="solar-prominence-arc arc4"></div>
        <div class="solar-magnetic-loop loop1"></div>
        <div class="solar-magnetic-loop loop2"></div>
        <div class="solar-magnetic-loop loop3"></div>
      </div>
      <div class="solar-coronal-wind"></div>
      <div class="solar-plasma-ember pe1"></div>
      <div class="solar-plasma-ember pe2"></div>
      <div class="solar-plasma-ember pe3"></div>
      <div class="solar-plasma-ember pe4"></div>
      <div class="solar-plasma-ember pe5"></div>
      <div class="solar-plasma-ember pe6"></div>
      <div class="solar-plasma-ember pe7"></div>
      <div class="solar-plasma-ember pe8"></div>
      <div class="solar-godray-sweep"></div>
    </div>
  `,
  theme_solar_prominence: `
    <div id="theme-solar_prominence-bg" class="theme-3d-scene solar-3d-stage" aria-hidden="true">
      <div class="solar-photosphere-glow"></div>
      <div class="solar-granulation-surface"></div>
      <div class="solar-heliosphere-ring"></div>
      <div class="solar-3d-sun">
        <div class="solar-core-sphere">
          <div class="solar-sunspot sp1"></div>
          <div class="solar-sunspot sp2"></div>
          <div class="solar-sunspot sp3"></div>
        </div>
        <div class="solar-prominence-arc arc1"></div>
        <div class="solar-prominence-arc arc2"></div>
        <div class="solar-prominence-arc arc3"></div>
        <div class="solar-prominence-arc arc4"></div>
        <div class="solar-magnetic-loop loop1"></div>
        <div class="solar-magnetic-loop loop2"></div>
        <div class="solar-magnetic-loop loop3"></div>
      </div>
      <div class="solar-coronal-wind"></div>
      <div class="solar-plasma-ember pe1"></div>
      <div class="solar-plasma-ember pe2"></div>
      <div class="solar-plasma-ember pe3"></div>
      <div class="solar-plasma-ember pe4"></div>
      <div class="solar-plasma-ember pe5"></div>
      <div class="solar-plasma-ember pe6"></div>
      <div class="solar-plasma-ember pe7"></div>
      <div class="solar-plasma-ember pe8"></div>
      <div class="solar-godray-sweep"></div>
    </div>
  `,

  // 6. Diamond Refractor (💎 Tier 50) - 3D Crystal Prism Sanctum & Caustic Dispersion Chamber
  prism_mythic: `
    <div id="theme-prism_mythic-bg" class="theme-3d-scene prism-mythic-3d-stage" aria-hidden="true">
      <div class="prism-obsidian-bedrock"></div>
      <div class="prism-refraction-caustic-primary"></div>
      <div class="prism-refraction-caustic-secondary"></div>
      <div class="prism-spectrum-chamber">
        <div class="prism-spectrum-arc red"></div>
        <div class="prism-spectrum-arc gold"></div>
        <div class="prism-spectrum-arc emerald"></div>
        <div class="prism-spectrum-arc cyan"></div>
        <div class="prism-spectrum-arc violet"></div>
      </div>
      <div class="prism-3d-crystal-stage">
        <div class="prism-crystal-halo"></div>
        <div class="prism-rotating-polyhedron">
          <div class="crystal-face f1"></div>
          <div class="crystal-face f2"></div>
          <div class="crystal-face f3"></div>
          <div class="crystal-face f4"></div>
          <div class="crystal-face f5"></div>
          <div class="crystal-face f6"></div>
          <div class="crystal-face-top"></div>
          <div class="crystal-face-bottom"></div>
          <div class="crystal-core-sparkle"></div>
        </div>
      </div>
      <div class="prism-dispersion-ray ray1"></div>
      <div class="prism-dispersion-ray ray2"></div>
      <div class="prism-dispersion-ray ray3"></div>
      <div class="prism-dispersion-ray ray4"></div>
      <div class="prism-diamond-shard ds1"></div>
      <div class="prism-diamond-shard ds2"></div>
      <div class="prism-diamond-shard ds3"></div>
      <div class="prism-diamond-shard ds4"></div>
      <div class="prism-diamond-shard ds5"></div>
      <div class="prism-diamond-shard ds6"></div>
      <div class="prism-refractor-sparkle ps1"></div>
      <div class="prism-refractor-sparkle ps2"></div>
      <div class="prism-refractor-sparkle ps3"></div>
      <div class="prism-refractor-sparkle ps4"></div>
      <div class="prism-refractor-sparkle ps5"></div>
      <div class="prism-refractor-sparkle ps6"></div>
      <div class="prism-refractor-sparkle ps7"></div>
    </div>
  `,
  theme_prism_mythic: `
    <div id="theme-prism_mythic-bg" class="theme-3d-scene prism-mythic-3d-stage" aria-hidden="true">
      <div class="prism-obsidian-bedrock"></div>
      <div class="prism-refraction-caustic-primary"></div>
      <div class="prism-refraction-caustic-secondary"></div>
      <div class="prism-spectrum-chamber">
        <div class="prism-spectrum-arc red"></div>
        <div class="prism-spectrum-arc gold"></div>
        <div class="prism-spectrum-arc emerald"></div>
        <div class="prism-spectrum-arc cyan"></div>
        <div class="prism-spectrum-arc violet"></div>
      </div>
      <div class="prism-3d-crystal-stage">
        <div class="prism-crystal-halo"></div>
        <div class="prism-rotating-polyhedron">
          <div class="crystal-face f1"></div>
          <div class="crystal-face f2"></div>
          <div class="crystal-face f3"></div>
          <div class="crystal-face f4"></div>
          <div class="crystal-face f5"></div>
          <div class="crystal-face f6"></div>
          <div class="crystal-face-top"></div>
          <div class="crystal-face-bottom"></div>
          <div class="crystal-core-sparkle"></div>
        </div>
      </div>
      <div class="prism-dispersion-ray ray1"></div>
      <div class="prism-dispersion-ray ray2"></div>
      <div class="prism-dispersion-ray ray3"></div>
      <div class="prism-dispersion-ray ray4"></div>
      <div class="prism-diamond-shard ds1"></div>
      <div class="prism-diamond-shard ds2"></div>
      <div class="prism-diamond-shard ds3"></div>
      <div class="prism-diamond-shard ds4"></div>
      <div class="prism-diamond-shard ds5"></div>
      <div class="prism-diamond-shard ds6"></div>
      <div class="prism-refractor-sparkle ps1"></div>
      <div class="prism-refractor-sparkle ps2"></div>
      <div class="prism-refractor-sparkle ps3"></div>
      <div class="prism-refractor-sparkle ps4"></div>
      <div class="prism-refractor-sparkle ps5"></div>
      <div class="prism-refractor-sparkle ps6"></div>
      <div class="prism-refractor-sparkle ps7"></div>
    </div>
  `,

  // 7. Celestial Nebula (🌠 Tier 65) - 3D Deep Space Parallax Nebula & Starfield
  celestial_nebula: `
    <div id="theme-celestial_nebula-bg" class="theme-3d-scene celestial-3d-stage" aria-hidden="true">
      <div class="nebula-deep-space"></div>
      <div class="nebula-cloud-layer nc-back"></div>
      <div class="nebula-cloud-layer nc-mid"></div>
      <div class="nebula-cloud-layer nc-front"></div>
      <div class="nebula-cosmic-pillar cp1"></div>
      <div class="nebula-cosmic-pillar cp2"></div>
      <div class="nebula-3d-starfield">
        <div class="star-layer sl-back"></div>
        <div class="star-layer sl-mid"></div>
        <div class="star-layer sl-front"></div>
      </div>
      <div class="celestial-starlight-filament sf1"></div>
      <div class="celestial-starlight-filament sf2"></div>
      <div class="celestial-starlight-filament sf3"></div>
      <div class="celestial-comet-trail ct1"></div>
      <div class="celestial-comet-trail ct2"></div>
      <div class="celestial-comet-trail ct3"></div>
      <div class="celestial-glitter-mote gm1"></div>
      <div class="celestial-glitter-mote gm2"></div>
      <div class="celestial-glitter-mote gm3"></div>
      <div class="celestial-glitter-mote gm4"></div>
      <div class="celestial-glitter-mote gm5"></div>
      <div class="celestial-glitter-mote gm6"></div>
      <div class="celestial-glitter-mote gm7"></div>
    </div>
  `,
  theme_celestial_nebula: `
    <div id="theme-celestial_nebula-bg" class="theme-3d-scene celestial-3d-stage" aria-hidden="true">
      <div class="nebula-deep-space"></div>
      <div class="nebula-cloud-layer nc-back"></div>
      <div class="nebula-cloud-layer nc-mid"></div>
      <div class="nebula-cloud-layer nc-front"></div>
      <div class="nebula-cosmic-pillar cp1"></div>
      <div class="nebula-cosmic-pillar cp2"></div>
      <div class="nebula-3d-starfield">
        <div class="star-layer sl-back"></div>
        <div class="star-layer sl-mid"></div>
        <div class="star-layer sl-front"></div>
      </div>
      <div class="celestial-starlight-filament sf1"></div>
      <div class="celestial-starlight-filament sf2"></div>
      <div class="celestial-starlight-filament sf3"></div>
      <div class="celestial-comet-trail ct1"></div>
      <div class="celestial-comet-trail ct2"></div>
      <div class="celestial-comet-trail ct3"></div>
      <div class="celestial-glitter-mote gm1"></div>
      <div class="celestial-glitter-mote gm2"></div>
      <div class="celestial-glitter-mote gm3"></div>
      <div class="celestial-glitter-mote gm4"></div>
      <div class="celestial-glitter-mote gm5"></div>
      <div class="celestial-glitter-mote gm6"></div>
      <div class="celestial-glitter-mote gm7"></div>
    </div>
  `,

  // 8. Kraken Abyss (🦑 Tier 80) - 3D Abyssal Trench & Bioluminescent Leviathan
  abyss_kraken: `
    <div id="theme-abyss_kraken-bg" class="theme-3d-scene kraken-3d-stage" aria-hidden="true">
      <div class="kraken-abyssal-floor"></div>
      <div class="kraken-trench-caustics"></div>
      <div class="kraken-hydrothermal-vent hv1"><div class="vent-plume"></div></div>
      <div class="kraken-hydrothermal-vent hv2"><div class="vent-plume"></div></div>
      <div class="kraken-25d-stage">
        <div class="kraken-tentacle-3d t1">
          <div class="tentacle-segment s1"></div>
          <div class="tentacle-segment s2"></div>
          <div class="tentacle-segment s3"></div>
          <div class="tentacle-sucker glow-cyan sk1"></div>
          <div class="tentacle-sucker glow-cyan sk2"></div>
        </div>
        <div class="kraken-tentacle-3d t2">
          <div class="tentacle-segment s1"></div>
          <div class="tentacle-segment s2"></div>
          <div class="tentacle-segment s3"></div>
          <div class="tentacle-sucker glow-magenta sk1"></div>
          <div class="tentacle-sucker glow-magenta sk2"></div>
        </div>
        <div class="kraken-tentacle-3d t3">
          <div class="tentacle-segment s1"></div>
          <div class="tentacle-segment s2"></div>
          <div class="tentacle-segment s3"></div>
          <div class="tentacle-sucker glow-cyan sk1"></div>
        </div>
        <div class="kraken-tentacle-3d t4">
          <div class="tentacle-segment s1"></div>
          <div class="tentacle-segment s2"></div>
          <div class="tentacle-sucker glow-teal sk1"></div>
        </div>
        <div class="kraken-tentacle-3d t5">
          <div class="tentacle-segment s1"></div>
          <div class="tentacle-segment s2"></div>
          <div class="tentacle-sucker glow-magenta sk1"></div>
        </div>
        <div class="kraken-tentacle-3d t6">
          <div class="tentacle-segment s1"></div>
          <div class="tentacle-segment s2"></div>
          <div class="tentacle-sucker glow-cyan sk1"></div>
        </div>
      </div>
      <div class="kraken-sonar-ping sp1"></div>
      <div class="kraken-sonar-ping sp2"></div>
      <div class="kraken-sonar-ping sp3"></div>
      <div class="kraken-plankton-mote pm1"></div>
      <div class="kraken-plankton-mote pm2"></div>
      <div class="kraken-plankton-mote pm3"></div>
      <div class="kraken-plankton-mote pm4"></div>
      <div class="kraken-plankton-mote pm5"></div>
      <div class="kraken-plankton-mote pm6"></div>
      <div class="kraken-plankton-mote pm7"></div>
      <div class="kraken-plankton-mote pm8"></div>
    </div>
  `,
  theme_abyss_kraken: `
    <div id="theme-abyss_kraken-bg" class="theme-3d-scene kraken-3d-stage" aria-hidden="true">
      <div class="kraken-abyssal-floor"></div>
      <div class="kraken-trench-caustics"></div>
      <div class="kraken-hydrothermal-vent hv1"><div class="vent-plume"></div></div>
      <div class="kraken-hydrothermal-vent hv2"><div class="vent-plume"></div></div>
      <div class="kraken-25d-stage">
        <div class="kraken-tentacle-3d t1">
          <div class="tentacle-segment s1"></div>
          <div class="tentacle-segment s2"></div>
          <div class="tentacle-segment s3"></div>
          <div class="tentacle-sucker glow-cyan sk1"></div>
          <div class="tentacle-sucker glow-cyan sk2"></div>
        </div>
        <div class="kraken-tentacle-3d t2">
          <div class="tentacle-segment s1"></div>
          <div class="tentacle-segment s2"></div>
          <div class="tentacle-segment s3"></div>
          <div class="tentacle-sucker glow-magenta sk1"></div>
          <div class="tentacle-sucker glow-magenta sk2"></div>
        </div>
        <div class="kraken-tentacle-3d t3">
          <div class="tentacle-segment s1"></div>
          <div class="tentacle-segment s2"></div>
          <div class="tentacle-segment s3"></div>
          <div class="tentacle-sucker glow-cyan sk1"></div>
        </div>
        <div class="kraken-tentacle-3d t4">
          <div class="tentacle-segment s1"></div>
          <div class="tentacle-segment s2"></div>
          <div class="tentacle-sucker glow-teal sk1"></div>
        </div>
        <div class="kraken-tentacle-3d t5">
          <div class="tentacle-segment s1"></div>
          <div class="tentacle-segment s2"></div>
          <div class="tentacle-sucker glow-magenta sk1"></div>
        </div>
        <div class="kraken-tentacle-3d t6">
          <div class="tentacle-segment s1"></div>
          <div class="tentacle-segment s2"></div>
          <div class="tentacle-sucker glow-cyan sk1"></div>
        </div>
      </div>
      <div class="kraken-sonar-ping sp1"></div>
      <div class="kraken-sonar-ping sp2"></div>
      <div class="kraken-sonar-ping sp3"></div>
      <div class="kraken-plankton-mote pm1"></div>
      <div class="kraken-plankton-mote pm2"></div>
      <div class="kraken-plankton-mote pm3"></div>
      <div class="kraken-plankton-mote pm4"></div>
      <div class="kraken-plankton-mote pm5"></div>
      <div class="kraken-plankton-mote pm6"></div>
      <div class="kraken-plankton-mote pm7"></div>
      <div class="kraken-plankton-mote pm8"></div>
    </div>
  `,

  // 9. Apex Sovereign Gold (👑 Tier 100) - Epic 3D Imperial Gold Pantheon & Stargate World
  apex_sovereign: `
    <div id="theme-apex_sovereign-bg" class="theme-3d-scene sovereign-3d-stage" aria-hidden="true">
      <div class="sovereign-celestial-void"></div>
      <div class="sovereign-3d-floor-grid"></div>
      <div class="sovereign-3d-colonnade">
        <div class="gilded-column col-left-1"><div class="column-flute"></div><div class="column-capital"></div></div>
        <div class="gilded-column col-left-2"><div class="column-flute"></div><div class="column-capital"></div></div>
        <div class="gilded-column col-left-3"><div class="column-flute"></div><div class="column-capital"></div></div>
        <div class="gilded-column col-right-1"><div class="column-flute"></div><div class="column-capital"></div></div>
        <div class="gilded-column col-right-2"><div class="column-flute"></div><div class="column-capital"></div></div>
        <div class="gilded-column col-right-3"><div class="column-flute"></div><div class="column-capital"></div></div>
      </div>
      <div class="sovereign-stargate-3d">
        <div class="sovereign-stargate-ring ring-outer">
          <span class="sovereign-rune r1">⚡</span>
          <span class="sovereign-rune r2">👑</span>
          <span class="sovereign-rune r3">⚜️</span>
          <span class="sovereign-rune r4">💎</span>
        </div>
        <div class="sovereign-stargate-ring ring-mid">
          <span class="sovereign-rune r5">✦</span>
          <span class="sovereign-rune r6">★</span>
          <span class="sovereign-rune r7">✦</span>
          <span class="sovereign-rune r8">★</span>
        </div>
        <div class="sovereign-stargate-ring ring-inner"></div>
        <div class="sovereign-stargate-core"></div>
      </div>
      <div class="sovereign-3d-crown-stage">
        <div class="sovereign-floating-crown">
          <div class="crown-aura-ring"></div>
          <div class="crown-base-ring"></div>
          <div class="crown-peak p1"></div>
          <div class="crown-peak p2"></div>
          <div class="crown-peak p3"></div>
          <div class="crown-peak p4"></div>
          <div class="crown-peak p5"></div>
          <div class="crown-gem ruby"></div>
          <div class="crown-gem emerald-l"></div>
          <div class="crown-gem emerald-r"></div>
        </div>
      </div>
      <div class="sovereign-monolith-orbit">
        <div class="sovereign-monolith m1"><div class="monolith-face"></div><div class="monolith-rune">👑</div></div>
        <div class="sovereign-monolith m2"><div class="monolith-face"></div><div class="monolith-rune">⚡</div></div>
        <div class="sovereign-monolith m3"><div class="monolith-face"></div><div class="monolith-rune">⚜️</div></div>
        <div class="sovereign-monolith m4"><div class="monolith-face"></div><div class="monolith-rune">💎</div></div>
      </div>
      <div class="sovereign-god-rays">
        <div class="sovereign-light-shaft ls1"></div>
        <div class="sovereign-light-shaft ls2"></div>
        <div class="sovereign-light-shaft ls3"></div>
        <div class="sovereign-light-shaft ls4"></div>
        <div class="sovereign-light-shaft ls5"></div>
      </div>
      <div class="sovereign-gold-flakes">
        <div class="sovereign-gold-flake gf1"></div>
        <div class="sovereign-gold-flake gf2"></div>
        <div class="sovereign-gold-flake gf3"></div>
        <div class="sovereign-gold-flake gf4"></div>
        <div class="sovereign-gold-flake gf5"></div>
        <div class="sovereign-gold-flake gf6"></div>
        <div class="sovereign-gold-flake gf7"></div>
        <div class="sovereign-gold-flake gf8"></div>
        <div class="sovereign-gold-flake gf9"></div>
        <div class="sovereign-gold-flake gf10"></div>
        <div class="sovereign-gold-flake gf11"></div>
        <div class="sovereign-gold-flake gf12"></div>
        <div class="sovereign-gold-flake gf13"></div>
        <div class="sovereign-gold-flake gf14"></div>
        <div class="sovereign-gold-flake gf15"></div>
        <div class="sovereign-gold-flake gf16"></div>
      </div>
      <div class="sovereign-horizon-corona"></div>
    </div>
  `,
  theme_apex_sovereign: `
    <div id="theme-apex_sovereign-bg" class="theme-3d-scene sovereign-3d-stage" aria-hidden="true">
      <div class="sovereign-celestial-void"></div>
      <div class="sovereign-3d-floor-grid"></div>
      <div class="sovereign-3d-colonnade">
        <div class="gilded-column col-left-1"><div class="column-flute"></div><div class="column-capital"></div></div>
        <div class="gilded-column col-left-2"><div class="column-flute"></div><div class="column-capital"></div></div>
        <div class="gilded-column col-left-3"><div class="column-flute"></div><div class="column-capital"></div></div>
        <div class="gilded-column col-right-1"><div class="column-flute"></div><div class="column-capital"></div></div>
        <div class="gilded-column col-right-2"><div class="column-flute"></div><div class="column-capital"></div></div>
        <div class="gilded-column col-right-3"><div class="column-flute"></div><div class="column-capital"></div></div>
      </div>
      <div class="sovereign-stargate-3d">
        <div class="sovereign-stargate-ring ring-outer">
          <span class="sovereign-rune r1">⚡</span>
          <span class="sovereign-rune r2">👑</span>
          <span class="sovereign-rune r3">⚜️</span>
          <span class="sovereign-rune r4">💎</span>
        </div>
        <div class="sovereign-stargate-ring ring-mid">
          <span class="sovereign-rune r5">✦</span>
          <span class="sovereign-rune r6">★</span>
          <span class="sovereign-rune r7">✦</span>
          <span class="sovereign-rune r8">★</span>
        </div>
        <div class="sovereign-stargate-ring ring-inner"></div>
        <div class="sovereign-stargate-core"></div>
      </div>
      <div class="sovereign-3d-crown-stage">
        <div class="sovereign-floating-crown">
          <div class="crown-aura-ring"></div>
          <div class="crown-base-ring"></div>
          <div class="crown-peak p1"></div>
          <div class="crown-peak p2"></div>
          <div class="crown-peak p3"></div>
          <div class="crown-peak p4"></div>
          <div class="crown-peak p5"></div>
          <div class="crown-gem ruby"></div>
          <div class="crown-gem emerald-l"></div>
          <div class="crown-gem emerald-r"></div>
        </div>
      </div>
      <div class="sovereign-monolith-orbit">
        <div class="sovereign-monolith m1"><div class="monolith-face"></div><div class="monolith-rune">👑</div></div>
        <div class="sovereign-monolith m2"><div class="monolith-face"></div><div class="monolith-rune">⚡</div></div>
        <div class="sovereign-monolith m3"><div class="monolith-face"></div><div class="monolith-rune">⚜️</div></div>
        <div class="sovereign-monolith m4"><div class="monolith-face"></div><div class="monolith-rune">💎</div></div>
      </div>
      <div class="sovereign-god-rays">
        <div class="sovereign-light-shaft ls1"></div>
        <div class="sovereign-light-shaft ls2"></div>
        <div class="sovereign-light-shaft ls3"></div>
        <div class="sovereign-light-shaft ls4"></div>
        <div class="sovereign-light-shaft ls5"></div>
      </div>
      <div class="sovereign-gold-flakes">
        <div class="sovereign-gold-flake gf1"></div>
        <div class="sovereign-gold-flake gf2"></div>
        <div class="sovereign-gold-flake gf3"></div>
        <div class="sovereign-gold-flake gf4"></div>
        <div class="sovereign-gold-flake gf5"></div>
        <div class="sovereign-gold-flake gf6"></div>
        <div class="sovereign-gold-flake gf7"></div>
        <div class="sovereign-gold-flake gf8"></div>
        <div class="sovereign-gold-flake gf9"></div>
        <div class="sovereign-gold-flake gf10"></div>
        <div class="sovereign-gold-flake gf11"></div>
        <div class="sovereign-gold-flake gf12"></div>
        <div class="sovereign-gold-flake gf13"></div>
        <div class="sovereign-gold-flake gf14"></div>
        <div class="sovereign-gold-flake gf15"></div>
        <div class="sovereign-gold-flake gf16"></div>
      </div>
      <div class="sovereign-horizon-corona"></div>
    </div>
  `,

  // 10. Verity Secret Theme (😊) - Solid Bright Yellow Wall of Vector SVG Smiley Faces
  verity: `
    <div id="theme-verity-bg" class="theme-3d-scene verity-3d-stage" aria-hidden="true">
      <div class="verity-smiley-grid">
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
      </div>
    </div>
  `,
  theme_verity: `
    <div id="theme-verity-bg" class="theme-3d-scene verity-3d-stage" aria-hidden="true">
      <div class="verity-smiley-grid">
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
        <svg class="verity-svg-face" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#ffff00" stroke="#000000" stroke-width="7"/><circle cx="34" cy="38" r="7" fill="#000000"/><circle cx="66" cy="38" r="7" fill="#000000"/><path d="M26 56 Q50 84 74 56" stroke="#000000" stroke-width="8" fill="none" stroke-linecap="round"/></svg>
      </div>
    </div>
  `
};

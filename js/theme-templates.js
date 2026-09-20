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
      <div class="astral-space-gradient"></div>
      <div class="astral-nebula n1"></div>
      <div class="astral-nebula n2"></div>
      <div class="astral-nebula n3"></div>
      <div class="astral-vortex-outer"></div>
      <div class="astral-vortex-inner"></div>
      <div class="astral-accretion-disk"></div>
      <div class="astral-singularity-core"></div>
      <div class="astral-pulsar-beam v"></div>
      <div class="astral-pulsar-beam h"></div>
      <div class="astral-glyph g1"></div>
      <div class="astral-glyph g2"></div>
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
      <div class="astral-comet ac1"></div>
      <div class="astral-comet ac2"></div>
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
  `
};

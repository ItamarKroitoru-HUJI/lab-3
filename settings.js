// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  colors: { background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a,
    goldCoin: 0xff9f1c },
  goldCoin: { every: 5, points: 3 },
  coinEffect: {
    ringRadius: 9, ringScale: 4, ringStroke: 3, ringMs: 380,
    pulseScale: 1.25, pulseStroke: 2, pulseMs: 110,
    flashAlpha: 0.06, flashMs: 120
  },
  floatText: { rise: 36, ms: 600, font: '18px monospace' }
};

// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  colors: { background: 0x0a0618, player: 0x00fff0, coin: 0xffee00, drone: 0xff1744 },
  coinEffect: {
    ringRadius: 9, ringScale: 4, ringStroke: 3, ringMs: 380,
    pulseScale: 1.25, pulseStroke: 2, pulseMs: 110,
    flashAlpha: 0.06, flashMs: 120
  }
};

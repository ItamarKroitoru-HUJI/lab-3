// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  droneSpeed: 105,
  droneCount: 3,
  boost: {
    spawnMinSeconds: 8,
    spawnMaxSeconds: 12,
    lifetimeSeconds: 6,
    durationSeconds: 5,
    speedMultiplier: 1.6,
    size: 16,
    minSpawnDistance: 150
  },
  colors: { background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a, boost: 0x4ade80 }
};

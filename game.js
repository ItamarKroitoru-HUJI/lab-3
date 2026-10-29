/* global Phaser, COIN_DASH */
// Pickup types. shape() returns polygon points inside a size x size box.
const POWER_UPS = {
  speed: {
    label: 'Speed',
    seconds: () => COIN_DASH.powerUps.speed.durationSeconds,
    shape: s => [s / 2, 0, s, s / 2, s / 2, s, 0, s / 2]
  },
  freeze: {
    label: 'Freeze',
    seconds: () => COIN_DASH.powerUps.freeze.durationSeconds,
    shape: s => regularPolygon(6, s),
    start: scene => scene.drones.getChildren().forEach(d => {
      d.savedVelocity = d.body.velocity.clone();
      d.body.setVelocity(0, 0);
    }),
    end: scene => scene.drones.getChildren().forEach(d => d.body.setVelocity(d.savedVelocity.x, d.savedVelocity.y))
  },
  shield: {
    label: 'Shield',
    // No seconds(): the shield lasts until it absorbs one drone hit.
    shape: s => [s / 2, 0, s, s, 0, s],
    start: scene => scene.player.setStrokeStyle(COIN_DASH.powerUps.shield.glowWidth, COIN_DASH.colors.shield),
    end: scene => scene.player.setStrokeStyle()
  },
  magnet: {
    label: 'Magnet',
    seconds: () => COIN_DASH.powerUps.magnet.durationSeconds,
    shape: s => {
      const a = s / 3, b = 2 * s / 3;
      return [a, 0, b, 0, b, a, s, a, s, b, b, b, b, s, a, s, a, b, 0, b, 0, a, a, a];
    },
    tick: scene => {
      const m = COIN_DASH.powerUps.magnet;
      const { coin, player } = scene;
      if (Phaser.Math.Distance.Between(coin.x, coin.y, player.x, player.y) > m.radius) {
        coin.body.setVelocity(0, 0);
        return;
      }
      scene.physics.moveToObject(coin, player, m.pullSpeed);
    },
    end: scene => scene.coin.body.setVelocity(0, 0)
  }
};

function regularPolygon(sides, s) {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / sides;
    points.push(s / 2 + Math.cos(a) * s / 2, s / 2 + Math.sin(a) * s / 2);
  }
  return points;
}

class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => this.onDroneHit());
    this.createPowerUps();
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  createPowerUps() {
    const c = COIN_DASH;
    this.effects = {}; // type -> time.now at which the effect ends
    this.shieldGraceUntil = 0;
    this.pickup = null;
    this.pickups = this.physics.add.group();
    this.powerHud = this.add.text(c.width - 18, 22, '',
      { font: '14px monospace', color: '#ffffff', align: 'right', lineSpacing: 2 }).setOrigin(1, 0.5);
    this.physics.add.overlap(this.player, this.pickups, (player, pickup) => {
      if (this.finished) return;
      const type = pickup.powerType;
      this.removePickup();
      this.startEffect(type);
    });
    this.schedulePickup();
    // Effects and the HUD run on their own clock so update() stays untouched.
    this.time.addEvent({ delay: 50, loop: true, callback: () => this.tickEffects() });
  }

  schedulePickup() {
    const p = COIN_DASH.powerUps;
    this.time.delayedCall(Phaser.Math.Between(p.spawnMinSeconds * 1000, p.spawnMaxSeconds * 1000), () => {
      if (this.finished) return;
      this.spawnPickup(Phaser.Utils.Array.GetRandom(Object.keys(POWER_UPS)));
      this.schedulePickup();
    });
  }

  spawnPickup(type) {
    const c = COIN_DASH;
    const p = c.powerUps;
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < p.minSpawnDistance);
    this.removePickup();
    this.pickup = this.add.polygon(x, y, POWER_UPS[type].shape(p.size), c.colors[type]);
    this.pickup.powerType = type;
    this.pickups.add(this.pickup);
    this.pickup.body.setCircle(p.size / 2);
    this.pickup.expiry = this.time.delayedCall(p.lifetimeSeconds * 1000, () => this.removePickup());
  }

  removePickup() {
    if (!this.pickup) return;
    this.pickup.expiry.remove();
    this.pickup.destroy();
    this.pickup = null;
  }

  startEffect(type) {
    const def = POWER_UPS[type];
    // Picking up an active type refreshes its timer without restarting it.
    if (!this.effects[type] && def.start) def.start(this);
    this.effects[type] = def.seconds ? this.time.now + def.seconds() * 1000 : Infinity;
  }

  endEffect(type) {
    if (!this.effects[type]) return;
    delete this.effects[type];
    if (POWER_UPS[type].end) POWER_UPS[type].end(this);
  }

  tickEffects() {
    if (this.finished) return;
    const labels = [];
    for (const type of Object.keys(this.effects)) {
      const def = POWER_UPS[type];
      const left = (this.effects[type] - this.time.now) / 1000;
      if (left <= 0) { this.endEffect(type); continue; }
      if (def.tick) def.tick(this);
      labels.push(left === Infinity ? def.label : `${def.label} ${left.toFixed(1)}s`);
    }
    const lines = [];
    for (let i = 0; i < labels.length; i += 2) lines.push(labels.slice(i, i + 2).join('   '));
    this.powerHud.setText(lines.join('\n'));
  }

  onDroneHit() {
    if (this.time.now < this.shieldGraceUntil) return;
    if (!this.effects.shield) { this.finish('A drone caught you!'); return; }
    // The drone is still overlapping, so give a short grace window to get clear.
    this.endEffect('shield');
    this.shieldGraceUntil = this.time.now + COIN_DASH.powerUps.shield.graceSeconds * 1000;
    this.player.setAlpha(0.5);
    this.time.delayedCall(COIN_DASH.powerUps.shield.graceSeconds * 1000, () => this.player.setAlpha(1));
  }

  speedMultiplier() {
    return this.effects.speed ? COIN_DASH.powerUps.speed.multiplier : 1;
  }

  update() {
    if (this.finished) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed * this.speedMultiplier());
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    this.hud.setText(`Coins: ${this.score}                       Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const c = COIN_DASH;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\nPress R to try again`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});

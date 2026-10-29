/* global Phaser, COIN_DASH */
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.finished = false;
    this.pulse = null;
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
    this.collected = 0;
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
      const points = this.coin.gold ? c.goldCoin.points : 1;
      this.score += points;
      this.collected++;
      this.playCoinEffect(this.coin.x, this.coin.y);
      this.floatText(this.coin.x, this.coin.y, `+${points}`, this.coin.fillColor);
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => this.finish('A drone caught you!'));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
  }

  playCoinEffect(x, y) {
    const c = COIN_DASH, e = c.coinEffect;
    const ring = this.add.circle(x, y, e.ringRadius).setStrokeStyle(e.ringStroke, c.colors.coin);
    this.tweens.add({ targets: ring, scale: e.ringScale, alpha: 0, duration: e.ringMs,
      ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    const flash = this.add.rectangle(c.width / 2, c.height / 2, c.width, c.height,
      c.colors.coin, e.flashAlpha);
    this.tweens.add({ targets: flash, alpha: 0, duration: e.flashMs,
      onComplete: () => flash.destroy() });
    // Pulse an outline, not the player: scaling the player would grow its arcade body.
    if (this.pulse) { this.pulse.tween.stop(); this.pulse.shape.destroy(); }
    const p = this.player;
    const shape = this.add.rectangle(p.x, p.y, p.width, p.height)
      .setStrokeStyle(e.pulseStroke, c.colors.player);
    const tween = this.tweens.add({ targets: shape, scale: e.pulseScale, duration: e.pulseMs,
      yoyo: true, ease: 'Sine.easeOut', onUpdate: () => shape.setPosition(p.x, p.y),
      onComplete: () => { shape.destroy(); this.pulse = null; } });
    this.pulse = { shape, tween };
  }

  floatText(x, y, message, color) {
    const f = COIN_DASH.floatText;
    const label = this.add.text(x, y - 12, message,
      { font: f.font, color: '#' + color.toString(16).padStart(6, '0') }).setOrigin(0.5);
    this.tweens.add({ targets: label, y: label.y - f.rise, alpha: 0, duration: f.ms,
      ease: 'Cubic.easeOut', onComplete: () => label.destroy() });
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
    this.coin.gold = (this.collected + 1) % c.goldCoin.every === 0;
    this.coin.setFillStyle(this.coin.gold ? c.colors.goldCoin : c.colors.coin);
  }

  update() {
    if (this.finished) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
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

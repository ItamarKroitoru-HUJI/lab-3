/* global Phaser, COIN_DASH */
const BEST_SCORE_KEY = 'coinDash.bestScore';
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.bestScore = this.loadBestScore();
    this.finished = false;
    this.paused = false;
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
    this.physics.add.overlap(this.player, this.drones, () => this.finish('A drone caught you!'));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    // Registering the keys makes Phaser ignore held-key auto-repeat, so holding P won't flicker.
    this.input.keyboard.addKeys('P,ESC');
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
  }

  togglePause() {
    if (this.finished) return;
    const c = COIN_DASH;
    if (!this.paused) {
      this.paused = true;
      this.pausedRemaining = this.deadline - this.time.now;
      this.physics.pause();
      this.pauseOverlay = [
        this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95),
        this.add.text(c.width / 2, c.height / 2 - 18, 'Paused',
          { font: '24px monospace', color: '#ffffff', align: 'center' }).setOrigin(0.5),
        this.add.text(c.width / 2, c.height / 2 + 22, 'Press P to resume',
          { font: '16px monospace', color: '#ffffff', align: 'center' }).setOrigin(0.5)
      ];
    } else {
      this.paused = false;
      this.deadline = this.time.now + this.pausedRemaining;
      this.physics.resume();
      this.pauseOverlay.forEach((o) => o.destroy());
      this.pauseOverlay = null;
    }
  }

  loadBestScore() {
    try {
      const best = Number(window.localStorage.getItem(BEST_SCORE_KEY));
      return Number.isSafeInteger(best) && best > 0 ? best : 0;
    } catch (e) {
      return 0;
    }
  }

  saveBestScore(best) {
    try {
      window.localStorage.setItem(BEST_SCORE_KEY, String(best));
    } catch (e) { /* storage blocked or full: keep playing without persistence */ }
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

  update() {
    if (this.finished || this.paused) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy);
    const pointer = this.input.activePointer;
    // Keyboard wins while any movement key is held; otherwise drag toward the pointer.
    if (direction.lengthSq() === 0 && pointer.isDown) {
      const toX = pointer.worldX - this.player.x;
      const toY = pointer.worldY - this.player.y;
      if (Math.hypot(toX, toY) > 6) direction.set(toX, toY);
    }
    direction.normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    const best = Math.max(this.bestScore, this.score);
    this.hud.setText(`Coins: ${this.score}     Best: ${best}     Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const c = COIN_DASH;
    const isNewBest = this.score > this.loadBestScore();
    if (isNewBest) this.saveBestScore(this.score);
    this.add.rectangle(c.width / 2, c.height / 2, 460, isNewBest ? 190 : 150, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score} coins collected\nPress R to try again${isNewBest ? '\nNew best!' : ''}`,
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

/* global Phaser, COIN_DASH */
const BEST_SCORE_KEY = 'coinDash.bestScore';
const CHASER_COLOR = 0xb388ff;
const CHASER_SPEED_FACTOR = 0.6;       // chaser speed as a share of the current drone speed
const SPEEDUP_INTERVAL_MS = 15000;     // round time between speed-ups
const SPEEDUP_FACTOR = 1.15;           // each speed-up makes drones 15% faster
const COINS_PER_NEW_DRONE = 10;        // a new bouncing drone joins every N coins
const DRONE_SPAWN_MIN_DISTANCE = 150;  // new drones spawn at least this far from the player
const TOP_SCORES_KEY = 'coinDash.topScores';
const START_LIVES = 3;
const INVULN_MS = 1500;
const GOLD_COIN_EVERY = 5;             // every Nth coin placed is golden
const GOLD_COIN_COLOR = 0xffaa00;
const GOLD_COIN_POINTS = 3;
const GOLD_COIN_SCALE = 1.4;
const COIN_WANDER_MS = 4000;           // play time before an uncollected coin jumps elsewhere
const POPUP_RISE_PX = 30;
const POPUP_MS = 500;
const DASH_MS = 200;                   // length of the dash burst
const DASH_SPEED_FACTOR = 3;           // dash speed as a multiple of player speed
const DASH_COOLDOWN_MS = 1500;         // cooldown after a dash ends
const TIME_COIN_COLOR = 0x4fc3ff;
const TIME_COIN_INTERVAL_MS = 12000;   // play time between time-coin spawns
const TIME_COIN_BONUS_MS = 5000;       // time added when collected
const TIME_COIN_LIFETIME_MS = 5000;    // it vanishes if not collected in this long
const TIME_COIN_MIN_DISTANCE = 60;     // spawns at least this far from the player
const COMBO_WINDOW_MS = 2000;          // a coin within this long of the last one counts double
const COMBO_TEXT_MS = 600;             // how long "Combo x2" shows
const POWERUP_INTERVAL_MS = 10000;     // play time between power-up spawns
const POWERUP_LIFETIME_MS = 5000;      // an untaken power-up disappears after this long
const POWERUP_MIN_DISTANCE = 80;       // power-ups spawn at least this far from the player
const POWERUP_PICKUP_RADIUS = 24;
const SHIELD_GRACE_MS = 800;           // brief invulnerability after a shield absorbs a hit
const BOOST_FACTOR = 1.6;
const BOOST_MS = 3000;
const FREEZE_MS = 3000;
const MAGNET_MS = 4000;
const MAGNET_RANGE = 200;
const MAGNET_SPEED = 200;
const POWERUPS = {
  S: { name: 'Shield!', color: 0x69f0ae },
  B: { name: 'Speed!', color: 0xffab40 },
  F: { name: 'Freeze!', color: 0x80d8ff },
  M: { name: 'Magnet!', color: 0xff80ab }
};
const ACHIEVEMENTS_KEY = 'coinDash.achievements';
const ACHIEVEMENTS = {
  first: 'First coin',
  pts10: '10 points',
  pts25: '25 points',
  golden: 'Golden touch',
  combo: 'Combo!',
  power: 'Power player',
  survivor: 'Survivor',
  untouchable: 'Untouchable'
};
const POWER_PLAYER_COUNT = 3;          // power-ups collected in one round
const SURVIVOR_MS = 30000;             // play time without losing a life
const TOAST_SLIDE_MS = 250;
const TOAST_HOLD_MS = 2000;
const TOAST_FADE_MS = 400;
const TOAST_MARGIN = 12;
class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create(data) {
    const c = COIN_DASH;
    this.score = 0;
    this.bestScore = this.loadBestScore();
    this.finished = false;
    this.paused = false;
    // 'start' (first load only) -> 'countdown' -> 'playing'. R restarts skip the start screen.
    this.phase = 'start';
    this.deadline = null; // set when the countdown ends
    this.droneSpeedNow = c.droneSpeed;
    this.speedLevel = 0;
    this.pendingDrones = 0;
    this.lives = START_LIVES;
    this.invulnMs = 0; // counted down in update(), so pause freezes it
    this.streak = 0;
    this.longestStreak = 0;
    this.dashMs = 0;         // time left in the current dash; counted down in update()
    this.dashCooldownMs = 0; // time left before the next dash; counted down in update()
    this.dashQueued = false; // Shift pressed; consumed in update() once a direction is known
    this.dashDir = new Phaser.Math.Vector2(0, 0);
    // Play-time timers (counted down/up in update() with delta, so pause and countdown don't count).
    this.comboMs = 0;          // time left in which the next coin counts double
    this.comboTextMs = 0;
    this.timeCoinSpawnMs = 0;
    this.timeCoinLifeMs = 0;   // > 0 while the time coin is on screen
    this.powerupTimerMs = 0; // all power-up timers count down with delta in update()
    this.powerup = null;     // { type, shape, label, ms } while one is on the field
    this.shield = false;
    this.boostMs = 0;
    this.freezeMs = 0;
    this.frozen = [];        // { d, vx, vy } saved drone velocities while frozen
    this.magnetMs = 0;
    this.unlocked = this.loadAchievements();
    this.toastQueue = [];
    this.toastActive = false;
    this.powerupsTaken = 0;  // this round only
    this.noHitMs = 0;        // play time since the last life lost
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x2a1f5c, 0.5);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.dashHud = this.add.text(18, 34, 'Dash: ready', { font: '14px monospace', color: '#ffffff' });
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.lastTrailAt = 0;
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coinsPlaced = 0;
    this.coinAgeMs = 0;
    this.coinGold = false;
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.timeCoin = this.add.circle(-100, -100, 9, TIME_COIN_COLOR);
    this.physics.add.existing(this.timeCoin);
    this.timeCoin.body.setCircle(9);
    this.hideTimeCoin();
    this.comboText = this.add.text(c.width / 2, 58, 'Combo x2',
      { font: '22px monospace', color: '#ffd84f' }).setOrigin(0.5).setVisible(false);
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * c.droneSpeed, Math.sin(angle) * c.droneSpeed);
    }
    this.chaser = this.add.rectangle(c.width - 60, c.height - 60, 26, 26, CHASER_COLOR);
    this.drones.add(this.chaser);
    this.chaser.body.setCollideWorldBounds(true);
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      const combo = this.comboMs > 0;
      const points = (this.coinGold ? GOLD_COIN_POINTS : 1) * (combo ? 2 : 1);
      this.popText(this.coin.x, this.coin.y, `+${points}`, this.coinGold);
      const before = this.score;
      this.score += points;
      // Spawn in update(), not here: don't add bodies in the middle of the physics step.
      // Count threshold crossings, since gold/combo coins can jump past a multiple of N.
      this.pendingDrones += Math.floor(this.score / COINS_PER_NEW_DRONE)
        - Math.floor(before / COINS_PER_NEW_DRONE);
      this.streak++;
      this.longestStreak = Math.max(this.longestStreak, this.streak);
      this.comboMs = COMBO_WINDOW_MS;
      this.unlock('first');
      if (this.score >= 10) this.unlock('pts10');
      if (this.score >= 25) this.unlock('pts25');
      if (this.coinGold) this.unlock('golden');
      if (combo) {
        this.comboTextMs = COMBO_TEXT_MS;
        this.comboText.setVisible(true);
        this.unlock('combo');
      }
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.timeCoin, () => {
      if (this.finished || this.timeCoinLifeMs <= 0) return;
      const cap = this.time.now + COIN_DASH.roundSeconds * 1000;
      this.deadline = Math.min(this.deadline + TIME_COIN_BONUS_MS, cap);
      this.hideTimeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => this.hitByDrone());
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart({ skipStart: true }));
    // Registering the keys makes Phaser ignore held-key auto-repeat, so holding P won't flicker.
    this.input.keyboard.addKeys('P,ESC,SPACE,SHIFT');
    this.input.keyboard.on('keydown-SHIFT', () => {
      if (this.phase === 'playing' && !this.paused && !this.finished) this.dashQueued = true;
    });
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.phase === 'start') this.startCountdown();
    });
    this.renderHud(c.roundSeconds);
    this.physics.pause(); // nothing moves until the countdown ends
    if (data && data.skipStart) {
      this.startCountdown();
    } else {
      this.startOverlay = [
        this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95),
        this.add.text(c.width / 2, c.height / 2, 'Coin Dash\nPress Space to start',
          { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
        ).setOrigin(0.5)
      ];
    }
  }

  startCountdown() {
    const c = COIN_DASH;
    this.phase = 'countdown';
    if (this.startOverlay) {
      this.startOverlay.forEach((o) => o.destroy());
      this.startOverlay = null;
    }
    let n = 3;
    const label = this.add.text(c.width / 2, c.height / 2, String(n),
      { font: '96px monospace', color: '#ffffff', align: 'center' }).setOrigin(0.5);
    this.time.addEvent({
      delay: 1000,
      repeat: 2,
      callback: () => {
        n--;
        if (n > 0) {
          label.setText(String(n));
        } else {
          label.destroy();
          this.phase = 'playing';
          this.deadline = this.time.now + c.roundSeconds * 1000;
          this.physics.resume();
        }
      }
    });
  }

  hitFeedback() {
    this.cameras.main.shake(250, 0.012);
    this.cameras.main.flash(150, 255, 40, 70);
  }

  spawnTrail() {
    // Plain rectangles (no physics body) so trail pieces never collide with anything.
    if (this.time.now - this.lastTrailAt < 30) return;
    this.lastTrailAt = this.time.now;
    const piece = this.add.rectangle(this.player.x, this.player.y, 14, 14, COIN_DASH.colors.player, 0.6);
    this.children.moveBelow(piece, this.player); // behind the player, under any overlay drawn later
    this.tweens.add({ targets: piece, alpha: 0, scale: 0.4, duration: 200, onComplete: () => piece.destroy() });
  }

  togglePause() {
    if (this.finished || this.phase !== 'playing') return;
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

  hitByDrone() {
    if (this.phase !== 'playing' || this.finished || this.paused || this.invulnMs > 0) return;
    if (this.shield) {
      this.shield = false;
      this.player.setStrokeStyle();
      this.invulnMs = SHIELD_GRACE_MS; // the overlap fires every frame; don't hit right after the shield pops
      return;
    }
    this.lives--;
    this.noHitMs = 0;
    this.streak = 0;
    this.comboMs = 0;
    this.hitFeedback();
    if (this.lives <= 0) {
      this.renderHud(this.secondsLeft());
      this.finish('A drone caught you!');
      return;
    }
    this.invulnMs = INVULN_MS;
    this.renderHud(this.secondsLeft());
  }

  remainingMs() {
    // No deadline before the countdown ends: the whole round is still ahead.
    if (this.deadline === null) return COIN_DASH.roundSeconds * 1000;
    if (this.paused) return this.pausedRemaining;
    return this.deadline - this.time.now;
  }

  secondsLeft() {
    return Math.max(0, Math.ceil(this.remainingMs() / 1000));
  }

  renderHud(seconds) {
    const best = Math.max(this.bestScore, this.score);
    this.hud.setText(
      `Coins: ${this.score}   Lives: ${this.lives}   Best: ${best}   Time: ${seconds}s`);
    this.hud.setColor(seconds <= 10 ? '#ff657a' : '#ffffff');
  }

  loadTopScores() {
    try {
      const list = JSON.parse(window.localStorage.getItem(TOP_SCORES_KEY));
      if (!Array.isArray(list)) return [];
      return list.filter((n) => Number.isSafeInteger(n) && n >= 0)
        .sort((a, b) => b - a).slice(0, 5);
    } catch (e) {
      return [];
    }
  }

  saveTopScores(list) {
    try {
      window.localStorage.setItem(TOP_SCORES_KEY, JSON.stringify(list));
    } catch (e) { /* storage blocked or full: keep playing without persistence */ }
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

  popText(x, y, label, gold) {
    const t = this.add.text(x, y, label,
      { font: '20px monospace', color: gold ? '#ffaa00' : '#ffffff' }).setOrigin(0.5);
    this.tweens.add({
      targets: t, y: y - POPUP_RISE_PX, alpha: 0, duration: POPUP_MS,
      onComplete: () => t.destroy()
    });
  }

  // relocate=true moves the current coin (wander) without counting a new coin or changing its kind.
  placeCoin(relocate) {
    const c = COIN_DASH;
    if (!relocate) {
      this.coinsPlaced++;
      this.coinGold = this.coinsPlaced % GOLD_COIN_EVERY === 0;
      this.coin.setFillStyle(this.coinGold ? GOLD_COIN_COLOR : c.colors.coin);
      this.coin.setScale(this.coinGold ? GOLD_COIN_SCALE : 1);
    }
    this.coinAgeMs = 0;
    // Avoid spawning the next coin directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  hideTimeCoin() {
    this.timeCoinLifeMs = 0;
    this.timeCoin.setVisible(false);
    this.timeCoin.body.enable = false;
  }

  spawnTimeCoin() {
    const c = COIN_DASH;
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < TIME_COIN_MIN_DISTANCE);
    this.timeCoin.setPosition(x, y);
    this.timeCoin.body.enable = true;
    this.timeCoin.body.reset(x, y);
    this.timeCoin.setVisible(true);
    this.timeCoinLifeMs = TIME_COIN_LIFETIME_MS;
  }

  loadAchievements() {
    try {
      const list = JSON.parse(window.localStorage.getItem(ACHIEVEMENTS_KEY));
      if (!Array.isArray(list)) return new Set();
      return new Set(list.filter((id) => Object.prototype.hasOwnProperty.call(ACHIEVEMENTS, id)));
    } catch (e) {
      return new Set();
    }
  }

  saveAchievements() {
    try {
      window.localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...this.unlocked]));
    } catch (e) { /* storage blocked or full: keep playing without persistence */ }
  }

  // Unlock by id; only the first unlock ever persists and shows a toast.
  unlock(id) {
    if (this.unlocked.has(id)) return;
    this.unlocked.add(id);
    this.saveAchievements();
    this.toastQueue.push(`🏆 ${ACHIEVEMENTS[id]}`);
    this.showNextToast();
  }

  // One toast at a time; tweens run on scene time, so the game never waits for them.
  showNextToast() {
    if (this.toastActive || this.toastQueue.length === 0) return;
    this.toastActive = true;
    const c = COIN_DASH;
    const x = c.width - TOAST_MARGIN;
    const toast = this.add.text(x + 40, c.height - TOAST_MARGIN, this.toastQueue.shift(), {
      font: '16px monospace', color: '#ffffff', backgroundColor: '#0a1120', padding: { x: 10, y: 6 }
    }).setOrigin(1, 1).setDepth(1000).setAlpha(0);
    this.tweens.add({
      targets: toast, x, alpha: 1, duration: TOAST_SLIDE_MS,
      onComplete: () => this.tweens.add({
        targets: toast, alpha: 0, delay: TOAST_HOLD_MS, duration: TOAST_FADE_MS,
        onComplete: () => {
          toast.destroy();
          this.toastActive = false;
          this.showNextToast();
        }
      })
    });
  }

  updateTimers(delta) {
    this.noHitMs += delta;
    if (this.noHitMs >= SURVIVOR_MS) this.unlock('survivor');
    this.comboMs = Math.max(0, this.comboMs - delta);
    if (this.comboTextMs > 0) {
      this.comboTextMs = Math.max(0, this.comboTextMs - delta);
      if (this.comboTextMs === 0) this.comboText.setVisible(false);
    }
    if (this.timeCoinLifeMs > 0) {
      this.timeCoinLifeMs -= delta;
      if (this.timeCoinLifeMs <= 0) this.hideTimeCoin();
    }
    this.timeCoinSpawnMs += delta;
    if (this.timeCoinSpawnMs >= TIME_COIN_INTERVAL_MS) {
      this.timeCoinSpawnMs = 0;
      this.spawnTimeCoin();
    }
  }

  spawnDrone() {
    const c = COIN_DASH;
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < DRONE_SPAWN_MIN_DISTANCE);
    const drone = this.add.rectangle(x, y, 26, 26, c.colors.drone);
    this.drones.add(drone);
    drone.body.setCollideWorldBounds(true).setBounce(1, 1);
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const vx = Math.cos(angle) * this.droneSpeedNow;
    const vy = Math.sin(angle) * this.droneSpeedNow;
    if (this.freezeMs > 0) this.frozen.push({ d: drone, vx, vy });
    else drone.body.setVelocity(vx, vy);
  }

  spawnPowerup(type) {
    const c = COIN_DASH;
    if (!type) type = Phaser.Utils.Array.GetRandom(Object.keys(POWERUPS));
    this.clearPowerup();
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < POWERUP_MIN_DISTANCE);
    const shape = this.add.star(x, y, 5, 7, 14, POWERUPS[type].color).setStrokeStyle(2, 0xffffff);
    const label = this.add.text(x, y, type, { font: 'bold 12px monospace', color: '#0a1120' }).setOrigin(0.5);
    this.powerup = { type, shape, label, ms: POWERUP_LIFETIME_MS };
  }

  clearPowerup() {
    if (!this.powerup) return;
    this.powerup.shape.destroy();
    this.powerup.label.destroy();
    this.powerup = null;
  }

  collectPowerup(type) {
    const p = POWERUPS[type];
    if (++this.powerupsTaken >= POWER_PLAYER_COUNT) this.unlock('power');
    if (type === 'S') {
      this.shield = true;
      this.player.setStrokeStyle(3, p.color);
    } else if (type === 'B') {
      this.boostMs = BOOST_MS;
    } else if (type === 'F') {
      if (this.freezeMs <= 0) {
        this.frozen = [];
        this.drones.getChildren().forEach((d) => {
          if (d !== this.chaser) this.frozen.push({ d, vx: d.body.velocity.x, vy: d.body.velocity.y });
          d.body.setVelocity(0, 0);
        });
      }
      this.freezeMs = FREEZE_MS;
    } else if (type === 'M') {
      this.magnetMs = MAGNET_MS;
    }
    const text = this.add.text(this.player.x, this.player.y - 26, p.name,
      { font: 'bold 18px monospace', color: '#' + p.color.toString(16).padStart(6, '0') }).setOrigin(0.5);
    this.tweens.add({ targets: text, y: text.y - 30, alpha: 0, duration: 900, onComplete: () => text.destroy() });
  }

  updatePowerups(delta) {
    this.powerupTimerMs += delta;
    if (this.powerupTimerMs >= POWERUP_INTERVAL_MS) {
      this.powerupTimerMs -= POWERUP_INTERVAL_MS;
      this.spawnPowerup();
    }
    if (this.powerup) {
      this.powerup.ms -= delta;
      const near = Phaser.Math.Distance.Between(this.player.x, this.player.y,
        this.powerup.shape.x, this.powerup.shape.y) < POWERUP_PICKUP_RADIUS;
      if (near) {
        const type = this.powerup.type;
        this.clearPowerup();
        this.collectPowerup(type);
      } else if (this.powerup.ms <= 0) {
        this.clearPowerup();
      }
    }
    this.boostMs = Math.max(0, this.boostMs - delta);
    this.magnetMs = Math.max(0, this.magnetMs - delta);
    if (this.freezeMs > 0) {
      this.freezeMs = Math.max(0, this.freezeMs - delta);
      if (this.freezeMs === 0) {
        this.frozen.forEach((f) => { if (f.d.body) f.d.body.setVelocity(f.vx, f.vy); });
        this.frozen = [];
      }
    }
    if (this.magnetMs > 0) {
      const dist = Phaser.Math.Distance.Between(this.coin.x, this.coin.y, this.player.x, this.player.y);
      if (dist < MAGNET_RANGE && dist > 1) {
        const step = Math.min(dist, MAGNET_SPEED * delta / 1000);
        this.coin.body.reset(this.coin.x + (this.player.x - this.coin.x) / dist * step,
          this.coin.y + (this.player.y - this.coin.y) / dist * step);
      }
    }
  }

  updateDrones() {
    // Round time = total minus remaining, so paused time (deadline is shifted on resume) doesn't count.
    const elapsed = COIN_DASH.roundSeconds * 1000 - this.remainingMs();
    const level = Math.floor(elapsed / SPEEDUP_INTERVAL_MS);
    while (this.speedLevel < level) {
      this.speedLevel++;
      this.droneSpeedNow *= SPEEDUP_FACTOR;
      this.drones.getChildren().forEach((d) => {
        if (d !== this.chaser) d.body.velocity.scale(SPEEDUP_FACTOR);
      });
      this.frozen.forEach((f) => { f.vx *= SPEEDUP_FACTOR; f.vy *= SPEEDUP_FACTOR; });
    }
    while (this.pendingDrones > 0) {
      this.pendingDrones--;
      this.spawnDrone();
    }
    // The chaser's velocity is recomputed every frame, so its speed follows droneSpeedNow.
    const toPlayer = new Phaser.Math.Vector2(this.player.x - this.chaser.x, this.player.y - this.chaser.y)
      .normalize().scale(this.droneSpeedNow * CHASER_SPEED_FACTOR);
    if (this.freezeMs <= 0) this.chaser.body.setVelocity(toPlayer.x, toPlayer.y);
  }

  update(time, delta) {
    if (this.finished || this.paused || this.phase !== 'playing') return;
    this.updateDrones();
    // update() only runs while playing and not paused, so this counts play time only.
    this.coinAgeMs += delta;
    if (this.coinAgeMs >= COIN_WANDER_MS) this.placeCoin(true);
    this.updateTimers(delta);
    this.updatePowerups(delta);
    if (this.invulnMs > 0) {
      this.invulnMs = Math.max(0, this.invulnMs - delta);
      this.player.setAlpha(this.invulnMs > 0 && Math.floor(this.invulnMs / 100) % 2 ? 0.25 : 1);
    }
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
    direction.normalize();
    // Dash: Shift starts a burst in the current direction (nothing happens without one).
    if (this.dashQueued && this.dashMs === 0 && this.dashCooldownMs === 0 && direction.lengthSq() > 0) {
      this.dashMs = DASH_MS;
      this.dashDir.copy(direction);
    }
    this.dashQueued = false;
    let speed = COIN_DASH.playerSpeed * (this.boostMs > 0 ? BOOST_FACTOR : 1);
    if (this.dashMs > 0) {
      this.dashMs = Math.max(0, this.dashMs - delta);
      if (this.dashMs === 0) this.dashCooldownMs = DASH_COOLDOWN_MS;
      direction.copy(this.dashDir); // the burst keeps its starting direction
      speed *= DASH_SPEED_FACTOR;
    } else if (this.dashCooldownMs > 0) {
      this.dashCooldownMs = Math.max(0, this.dashCooldownMs - delta);
    }
    this.dashHud.setText(this.dashCooldownMs > 0
      ? `Dash: ${(this.dashCooldownMs / 1000).toFixed(1)}s` : 'Dash: ready');
    this.dashHud.setColor(this.dashCooldownMs > 0 ? '#ff657a' : '#ffffff');
    direction.scale(speed);
    this.player.body.setVelocity(direction.x, direction.y);
    if (dx !== 0 || dy !== 0) this.spawnTrail();
    const seconds = this.secondsLeft();
    this.renderHud(seconds);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    this.player.setAlpha(1);
    const c = COIN_DASH;
    if (this.lives === START_LIVES) this.unlock('untouchable'); // only the time-up path can end with full lives
    const isNewBest = this.score > this.loadBestScore();
    if (isNewBest) this.saveBestScore(this.score);
    // The deadline shifts on resume, so remaining time excludes any paused time.
    const remainingMs = Math.max(0, Math.min(c.roundSeconds * 1000, this.remainingMs()));
    const playedSeconds = (c.roundSeconds * 1000 - remainingMs) / 1000;
    const perSecond = playedSeconds > 0 ? (this.score / playedSeconds).toFixed(1) : '0.0';
    const top = this.loadTopScores();
    top.push(this.score);
    top.sort((a, b) => b - a);
    top.splice(5);
    this.saveTopScores(top);
    const topLines = top.map((n, i) => `${i + 1}. ${n}`).join('\n');
    this.add.rectangle(c.width / 2, c.height / 2, 460, 410, 0x0a1120, 0.95);
    const head = this.add.text(c.width / 2, c.height / 2 - 192,
      `${reason}\n${this.score} coins collected${isNewBest ? '\nNew best!' : ''}`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 8 }
    ).setOrigin(0.5, 0);
    this.add.text(c.width / 2, head.y + head.height + 8,
      `Coins/sec: ${perSecond}\nLongest streak: ${this.longestStreak}\nAchievements: ${this.unlocked.size}/${Object.keys(ACHIEVEMENTS).length}\n\nTop 5\n${topLines}\n\nPress R to try again`,
      { font: '16px monospace', color: '#ffffff', align: 'center', lineSpacing: 4 }
    ).setOrigin(0.5, 0);
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
